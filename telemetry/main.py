"""
FastAPI Telemetry Microservice — SPORT Platform
================================================
Constitution §24.1: Telemetry Zone (FastAPI + Async)

Responsibility:
- High-throughput ingestion of OSMand-protocol GPS packets from Traccar.
- Async WebSocket broadcast to Admin Dashboard (live map).
- Write GPS points into TimescaleDB hypertable (gps_points).
- Fire Kalman smoothing on batch commit.

Run (dev):
    uvicorn telemetry.main:app --host 0.0.0.0 --port 8001 --reload
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any

import asyncpg
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Sentry — Milestone 3 Observability
_sentry_dsn = os.getenv("SENTRY_DSN", "")
if _sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.httpx import HttpxIntegration
        sentry_sdk.init(
            dsn=_sentry_dsn,
            integrations=[FastApiIntegration(), HttpxIntegration()],
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
            send_default_pii=False,
            environment=os.getenv("SENTRY_ENVIRONMENT", "development"),
            release=os.getenv("SENTRY_RELEASE", "local"),
        )
    except ImportError:
        pass  # sentry-sdk not installed — silent degradation

logger = logging.getLogger("telemetry")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SPORT Telemetry Engine",
    description="High-performance GPS ingestion and live broadcast service (Constitution §24.1)",
    version="1.0.0",
    docs_url="/api/telemetry/docs",
    openapi_url="/api/telemetry/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Database connection pool (TimescaleDB / PostgreSQL)
# ---------------------------------------------------------------------------

# Fail fast — DATABASE_URL must be set via .env / docker-compose
DB_DSN = os.environ["DATABASE_URL"]  # raises KeyError if missing

# Redis for Traccar pub/sub bridge
REDIS_URL  = os.getenv("REDIS_URL", "redis://redis:6379/0")
TRACCAR_CHANNEL = os.getenv("TRACCAR_REDIS_CHANNEL", "traccar:positions")

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """Returns (or creates) the shared asyncpg connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DB_DSN, min_size=2, max_size=10)
    return _pool


@app.on_event("startup")
async def startup() -> None:
    pool = await get_pool()
    # Ensure hypertable exists (idempotent)
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS gps_points (
                time        TIMESTAMPTZ     NOT NULL,
                device_id   TEXT            NOT NULL,
                user_id     INTEGER,
                lat         DOUBLE PRECISION NOT NULL,
                lon         DOUBLE PRECISION NOT NULL,
                speed_ms    DOUBLE PRECISION DEFAULT 0,
                accuracy_m  DOUBLE PRECISION DEFAULT 5,
                activity_id INTEGER
            );
        """)
        # Convert to TimescaleDB hypertable (no-op if already converted)
        try:
            await conn.execute(
                "SELECT create_hypertable('gps_points', 'time', if_not_exists => TRUE);"
            )
            logger.info("timescaledb: hypertable gps_points ready")
        except Exception as exc:
            logger.warning("timescaledb hypertable creation skipped: %s", exc)

    logger.info("telemetry service started — pool ready")
    # Start Traccar → Redis bridge as background task
    asyncio.create_task(_traccar_redis_bridge())
    logger.info("traccar_redis_bridge: listener started on channel=%s", TRACCAR_CHANNEL)


@app.on_event("shutdown")
async def shutdown() -> None:
    if _pool:
        await _pool.close()


# ---------------------------------------------------------------------------
# WebSocket connection manager (live map broadcast)
# ---------------------------------------------------------------------------

class ConnectionManager:
    """Manages active WebSocket connections for live map clients."""

    def __init__(self) -> None:
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)
        logger.info("ws.connected total=%d", len(self._connections))

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.remove(ws)
        logger.info("ws.disconnected total=%d", len(self._connections))

    async def broadcast(self, payload: dict) -> None:
        """Sends JSON payload to all connected clients."""
        dead: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.remove(ws)


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Traccar → Redis pub/sub bridge (Constitution §24.1 Architecture Fix)
# ---------------------------------------------------------------------------
# Traccar publishes positions to Redis channel 'traccar:positions' instead of
# sending HTTP webhooks to Django. This prevents cascading failures under load.
# The bridge consumes from Redis and broadcasts to WebSocket clients + writes DB.
# ---------------------------------------------------------------------------

async def _traccar_redis_bridge() -> None:
    """
    Subscribes to the Redis pub/sub channel that Traccar writes to.
    On each message, writes to TimescaleDB and broadcasts via WebSocket.

    Traccar publishes JSON: { deviceId, lat, lon, speed, timestamp }
    """
    import aioredis  # type: ignore[import]

    while True:
        try:
            redis = await aioredis.from_url(REDIS_URL)
            pubsub = redis.pubsub()
            await pubsub.subscribe(TRACCAR_CHANNEL)
            logger.info("traccar_bridge: subscribed to channel=%s", TRACCAR_CHANNEL)

            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                    device_id  = str(data.get("deviceId", data.get("id", "unknown")))
                    
                    # Traccar uses full names for latitude/longitude in forwarding
                    lat = float(data.get("latitude", data.get("lat", 0)))
                    lon = float(data.get("longitude", data.get("lon", 0)))
                    
                    # Speed is usually in knots in Traccar raw data, but let's assume m/s if it was converted,
                    # or knots (0.514444 m/s) if raw. Standard forwarding often sends knots.
                    speed_raw = float(data.get("speed", 0))
                    speed_ms = speed_raw * 0.514444 # Convert knots to m/s
                    
                    # Timestamp: fixTime is preferred (time of GPS lock)
                    ts_ms = data.get("fixTime", data.get("deviceTime", data.get("serverTime")))
                    ts = float(ts_ms) / 1000.0 if ts_ms else time.time()

                    # Log for debugging (only in non-prod or high log level)
                    logger.debug("traccar_bridge: pos device=%s lat=%.6f lon=%.6f speed=%.1f", 
                                 device_id, lat, lon, speed_ms)

                    # Write to TimescaleDB
                    pool = await get_pool()
                    async with pool.acquire() as conn:
                        await conn.execute(
                            """
                            INSERT INTO gps_points
                                (time, device_id, lat, lon, speed_ms)
                            VALUES (to_timestamp($1), $2, $3, $4, $5)
                            ON CONFLICT DO NOTHING
                            """,
                            ts, device_id, lat, lon, speed_ms,
                        )

                    # Broadcast to Admin Dashboard (live map)
                    await manager.broadcast({
                        "type":      "position_update",
                        "device_id": device_id,
                        "lat":       lat,
                        "lon":       lon,
                        "speed_ms":  speed_ms,
                        "ts":        ts
                    })

                except (KeyError, ValueError, json.JSONDecodeError) as exc:
                    logger.warning("traccar_bridge: malformed message err=%s", exc)

        except Exception as exc:
            logger.error("traccar_bridge: connection lost err=%s — reconnecting in 5s", exc)
            await asyncio.sleep(5)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GpsPacket(BaseModel):
    """Single GPS packet (OSMand-compatible)."""
    device_id: str = Field(..., description="Traccar device identifier")
    user_id: int | None = Field(None, description="SPORT user ID (resolved by Django)")
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    speed_ms: float = Field(0.0, ge=0, description="Speed in m/s")
    accuracy_m: float = Field(5.0, ge=0, description="GPS accuracy in metres")
    activity_id: int | None = Field(None, description="Active SPORT activity ID")
    timestamp: float = Field(
        default_factory=time.time,
        description="Unix timestamp (auto-set if omitted)",
    )


class BatchPacket(BaseModel):
    """Batch of GPS packets (sent every ~30s from mobile)."""
    packets: list[GpsPacket] = Field(..., min_length=1, max_length=500)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/telemetry/health")
async def health() -> dict:
    """Liveness probe."""
    return {"status": "ok", "service": "telemetry"}


@app.post("/api/telemetry/ingest", status_code=202)
async def ingest_packet(packet: GpsPacket) -> dict:
    """
    Accepts a single GPS packet and:
    1. Writes it to the TimescaleDB hypertable.
    2. Broadcasts it to connected WebSocket clients (live map).

    Returns:
        202 Accepted — fire-and-forget pattern.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO gps_points
                (time, device_id, user_id, lat, lon, speed_ms, accuracy_m, activity_id)
            VALUES (to_timestamp($1), $2, $3, $4, $5, $6, $7, $8)
            """,
            packet.timestamp,
            packet.device_id,
            packet.user_id,
            packet.lat,
            packet.lon,
            packet.speed_ms,
            packet.accuracy_m,
            packet.activity_id,
        )

    await manager.broadcast({
        "type": "position_update",
        "device_id": packet.device_id,
        "user_id": packet.user_id,
        "lat": packet.lat,
        "lon": packet.lon,
        "speed_ms": packet.speed_ms,
        "activity_id": packet.activity_id,
    })

    return {"status": "accepted"}


@app.post("/api/telemetry/ingest/batch", status_code=202)
async def ingest_batch(batch: BatchPacket) -> dict:
    """
    Accepts a batch of GPS packets (GPS Batching — Constitution §9.3).
    Writes all to TimescaleDB in a single COPY transaction.

    Returns:
        202 Accepted with count of inserted records.
    """
    pool = await get_pool()
    rows = [
        (
            p.timestamp, p.device_id, p.user_id,
            p.lat, p.lon, p.speed_ms, p.accuracy_m, p.activity_id,
        )
        for p in batch.packets
    ]
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO gps_points
                (time, device_id, user_id, lat, lon, speed_ms, accuracy_m, activity_id)
            VALUES (to_timestamp($1), $2, $3, $4, $5, $6, $7, $8)
            """,
            rows,
        )

    # Broadcast the last position from the batch
    last = batch.packets[-1]
    await manager.broadcast({
        "type": "position_update",
        "device_id": last.device_id,
        "user_id": last.user_id,
        "lat": last.lat,
        "lon": last.lon,
        "speed_ms": last.speed_ms,
        "activity_id": last.activity_id,
        "batch_size": len(batch.packets),
    })

    return {"status": "accepted", "inserted": len(rows)}


@app.get("/api/telemetry/live")
async def get_live_positions(
    device_id: str | None = Query(None, description="Filter by device"),
    limit: int = Query(50, ge=1, le=500),
) -> list[dict]:
    """
    Returns the latest GPS positions from TimescaleDB.
    Used by Admin Dashboard map when WebSocket is unavailable.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        if device_id:
            rows = await conn.fetch(
                """
                SELECT time, device_id, user_id, lat, lon, speed_ms
                FROM gps_points
                WHERE device_id = $1
                ORDER BY time DESC LIMIT $2
                """,
                device_id, limit,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT DISTINCT ON (device_id)
                    time, device_id, user_id, lat, lon, speed_ms
                FROM gps_points
                ORDER BY device_id, time DESC
                LIMIT $1
                """,
                limit,
            )

    return [dict(r) for r in rows]


@app.get("/api/telemetry/history/{device_id}")
async def get_device_history(
    device_id: str,
    since_unix: float = Query(..., description="Start timestamp (unix epoch)"),
    until_unix: float | None = Query(None, description="End timestamp (unix epoch)"),
) -> list[dict]:
    """
    Returns full GPS history for a device within a time window.
    Leverages TimescaleDB's time-range optimizations.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        if until_unix:
            rows = await conn.fetch(
                """
                SELECT time, lat, lon, speed_ms, accuracy_m, activity_id
                FROM gps_points
                WHERE device_id = $1
                  AND time BETWEEN to_timestamp($2) AND to_timestamp($3)
                ORDER BY time ASC
                """,
                device_id, since_unix, until_unix,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT time, lat, lon, speed_ms, accuracy_m, activity_id
                FROM gps_points
                WHERE device_id = $1
                  AND time >= to_timestamp($2)
                ORDER BY time ASC
                """,
                device_id, since_unix,
            )

    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# WebSocket endpoint (live map)
# ---------------------------------------------------------------------------

@app.websocket("/ws/telemetry/live")
async def websocket_live(ws: WebSocket) -> None:
    """
    WebSocket endpoint for the Admin Dashboard live map.
    Clients connect and receive real-time position_update events.
    """
    await manager.connect(ws)
    try:
        while True:
            # Keep the connection alive; data is pushed via manager.broadcast
            await asyncio.sleep(30)
            await ws.send_json({"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect(ws)
