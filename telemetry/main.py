"""
FastAPI Telemetry Microservice — SPORT Platform
================================================
Constitution §24.1: Telemetry Zone (FastAPI + Async)

Responsibility:
- High-throughput ingestion of OSMand-protocol GPS packets from Traccar.
- Async WebSocket broadcast to Admin Dashboard (live map).
- Write GPS points into TimescaleDB hypertable (gps_points).
- Real-time Geo-filtering for user privacy zones.

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
from math import radians, cos, sin, asin, sqrt

import asyncpg
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger("telemetry")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# App Configuration
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SPORT Telemetry Engine",
    description="High-performance GPS ingestion and live broadcast service (Constitution §24.1)",
    version="1.1.0",
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
# Infrastructure (DB & Redis)
# ---------------------------------------------------------------------------

DB_DSN = os.environ["DATABASE_URL"]
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
TRACCAR_CHANNEL = os.getenv("TRACCAR_REDIS_CHANNEL", "traccar:positions")
ZONE_UPDATE_CHANNEL = "privacy_zones:updates"

_pool: asyncpg.Pool | None = None
_insert_queue: asyncio.Queue[list[tuple]] | None = None
_insert_worker_task: asyncio.Task | None = None

_SKIP_DB = os.getenv("TELEMETRY_SKIP_DB", "").strip().lower() in ("1", "true", "yes")
_SKIP_BROADCAST = os.getenv("TELEMETRY_SKIP_BROADCAST", "").strip().lower() in ("1", "true", "yes")

try:
    _DB_POOL_MIN = max(1, int(os.getenv("TELEMETRY_DB_POOL_MIN", "5")))
except (TypeError, ValueError):
    _DB_POOL_MIN = 5
try:
    _DB_POOL_MAX = max(_DB_POOL_MIN, int(os.getenv("TELEMETRY_DB_POOL_MAX", "30")))
except (TypeError, ValueError):
    _DB_POOL_MAX = 30
try:
    _INGEST_BATCH_SIZE = max(1, int(os.getenv("TELEMETRY_INGEST_BATCH_SIZE", "100")))
except (TypeError, ValueError):
    _INGEST_BATCH_SIZE = 100
try:
    _INGEST_FLUSH_MS = max(10, int(os.getenv("TELEMETRY_INGEST_FLUSH_MS", "50")))
except (TypeError, ValueError):
    _INGEST_FLUSH_MS = 50

_INSERT_SQL = (
    "INSERT INTO gps_points (time, device_id, user_id, lat, lon, speed_ms, accuracy_m, activity_id, seq) "
    "VALUES (to_timestamp($1), $2, $3, $4, $5, $6, $7, $8, $9) "
    "ON CONFLICT (activity_id, time, seq) WHERE activity_id IS NOT NULL AND seq IS NOT NULL "
    "DO NOTHING"
)

# Local cache for privacy zones: {user_id: [ {lat, lon, radius, id}, ... ]}
_privacy_zones: dict[int, list[dict]] = {}


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DB_DSN,
            min_size=_DB_POOL_MIN,
            max_size=_DB_POOL_MAX,
            command_timeout=30,
        )
        logger.info(
            "db.pool ready min=%d max=%d batch=%d",
            _DB_POOL_MIN,
            _DB_POOL_MAX,
            _INGEST_BATCH_SIZE,
        )
    return _pool


async def _flush_insert_buffer(rows: list[tuple]) -> None:
    if not rows:
        return
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.executemany(_INSERT_SQL, rows)


async def _insert_worker() -> None:
    """Background batch inserter — amortizes DB round-trips under burst ingest."""
    assert _insert_queue is not None
    buffer: list[tuple] = []
    flush_interval = _INGEST_FLUSH_MS / 1000.0
    while True:
        try:
            chunk = await asyncio.wait_for(_insert_queue.get(), timeout=flush_interval)
            buffer.extend(chunk)
            _insert_queue.task_done()
        except asyncio.TimeoutError:
            pass
        except asyncio.CancelledError:
            if buffer:
                await _flush_insert_buffer(buffer)
            raise

        if len(buffer) >= _INGEST_BATCH_SIZE:
            batch = buffer
            buffer = []
            await _flush_insert_buffer(batch)


async def enqueue_gps_rows(rows: list[tuple]) -> None:
    """Queue rows for batched insert (used by HTTP + WebSocket ingest)."""
    global _insert_queue, _insert_worker_task
    if not rows or _SKIP_DB:
        return
    if _insert_queue is None:
        _insert_queue = asyncio.Queue(maxsize=max(_INGEST_BATCH_SIZE * 20, 500))
        _insert_worker_task = asyncio.create_task(_insert_worker())
    while True:
        try:
            _insert_queue.put_nowait(rows)
            return
        except asyncio.QueueFull:
            await asyncio.sleep(0.001)

# ---------------------------------------------------------------------------
# Geospatial Helpers
# ---------------------------------------------------------------------------

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine formula to calculate distance in meters."""
    R = 6371000  # Earth radius in meters
    dLat = radians(lat2 - lat1)
    dLon = radians(lon2 - lon1)
    lat1 = radians(lat1)
    lat2 = radians(lat2)
    a = sin(dLat/2)**2 + cos(lat1)*cos(lat2)*sin(dLon/2)**2
    c = 2*asin(sqrt(a))
    return R * c

def is_in_privacy_zone(user_id: int | None, lat: float, lon: float) -> bool:
    """Checks if a point is within any of the user's privacy zones (Live-Ghost Phase 4)."""
    if user_id is None or user_id not in _privacy_zones:
        return False
    
    for zone in _privacy_zones[user_id]:
        if calculate_distance(lat, lon, zone['lat'], zone['lon']) <= zone['radius']:
            return True
    return False

# ---------------------------------------------------------------------------
# Background Tasks
# ---------------------------------------------------------------------------

async def _privacy_zones_sync() -> None:
    """Listens for privacy zone updates from Django via Redis."""
    import redis.asyncio as redis_lib
    logger.info("privacy_zones_sync: initializing listener on %s", ZONE_UPDATE_CHANNEL)
    client = redis_lib.from_url(REDIS_URL, decode_responses=True)
    
    while True:
        try:
            async with client.pubsub() as pubsub:
                await pubsub.subscribe(ZONE_UPDATE_CHANNEL)
                async for message in pubsub.listen():
                    if message["type"] != "message": continue
                    data = json.loads(message["data"])
                    uid = int(data["user_id"])
                    
                    if data["type"] == "ZONE_UPDATE":
                        if uid not in _privacy_zones: _privacy_zones[uid] = []
                        zone = {
                            'lat': float(data['lat']), 
                            'lon': float(data['lon']), 
                            'radius': float(data['radius']), 
                            'id': data['zone_id']
                        }
                        # Remove existing version of this zone if present
                        _privacy_zones[uid] = [z for z in _privacy_zones[uid] if z.get('id') != data['zone_id']]
                        _privacy_zones[uid].append(zone)
                        logger.info("privacy_zones: updated zone %d for user %d", data['zone_id'], uid)
                    elif data["type"] == "ZONE_DELETE":
                        if uid in _privacy_zones:
                            _privacy_zones[uid] = [z for z in _privacy_zones[uid] if z.get('id') != data['zone_id']]
                            logger.info("privacy_zones: deleted zone %d for user %d", data['zone_id'], uid)

        except Exception as e:
            logger.error("privacy_zones_sync: connection error (%s). Retrying in 5s...", e)
            await asyncio.sleep(5)

async def _traccar_redis_bridge() -> None:
    """Consumes Traccar positions from Redis and broadcasts to UI."""
    import redis.asyncio as redis_lib
    batch_buffer: list[tuple] = []
    MAX_BATCH_SIZE = _INGEST_BATCH_SIZE
    last_flush = time.time()
    client = redis_lib.from_url(REDIS_URL, decode_responses=True)

    while True:
        try:
            async with client.pubsub() as pubsub:
                await pubsub.subscribe(TRACCAR_CHANNEL)
                async for message in pubsub.listen():
                    if message["type"] != "message": continue
                    try:
                        data = json.loads(message["data"]) if isinstance(message["data"], str) else message["data"]
                        device_id = str(data.get("deviceId", "unknown"))
                        lat = float(data.get("latitude", 0))
                        lon = float(data.get("longitude", 0))
                        speed_ms = float(data.get("speed", 0)) * 0.514444
                        ts = float(data.get("fixTime", time.time()*1000)) / 1000.0

                        # Traccar doesn't usually have user_id in the packet, needs resolution
                        # For now, bridge points are always stored but might skip broadcast if filtered
                        # (Filtering here requires device_id -> user_id mapping, which we can add later)

                        batch_buffer.append((ts, device_id, lat, lon, speed_ms))

                        if len(batch_buffer) >= MAX_BATCH_SIZE or (time.time() - last_flush > 2.0):
                            if batch_buffer:
                                pool = await get_pool()
                                async with pool.acquire() as conn:
                                    await conn.executemany(
                                        "INSERT INTO gps_points (time, device_id, lat, lon, speed_ms) VALUES (to_timestamp($1), $2, $3, $4, $5) ON CONFLICT DO NOTHING",
                                        batch_buffer
                                    )
                                batch_buffer = []
                                last_flush = time.time()

                        await manager.broadcast({
                            "type": "position_update",
                            "device_id": device_id,
                            "lat": lat,
                            "lon": lon,
                            "speed_ms": round(speed_ms, 2),
                            "ts": ts,
                            "source": "traccar_bridge"
                        })
                    except Exception as e:
                        logger.warning("traccar_bridge: skip malformed packet: %s", e)
        except Exception as e:
            logger.error("traccar_bridge: error: %s", e)
            await asyncio.sleep(5)

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS gps_points (
                time        TIMESTAMPTZ     NOT NULL,
                device_id   TEXT            NOT NULL,
                user_id     INTEGER,
                lat         DOUBLE PRECISION NOT NULL,
                lon         DOUBLE PRECISION NOT NULL,
                speed_ms    DOUBLE PRECISION DEFAULT 0,
                accuracy_m  DOUBLE PRECISION DEFAULT 5,
                activity_id INTEGER,
                seq         BIGINT
            );
        """)
        await conn.execute(
            "ALTER TABLE gps_points ADD COLUMN IF NOT EXISTS seq BIGINT;"
        )
        await conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS gps_points_activity_time_seq_uidx
            ON gps_points (activity_id, time, seq)
            WHERE activity_id IS NOT NULL AND seq IS NOT NULL;
        """)
        try:
            await conn.execute("SELECT create_hypertable('gps_points', 'time', if_not_exists => TRUE);")
        except Exception:
            pass

    # Load initial privacy zones
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT user_id, ST_Y(center::geometry) as lat, ST_X(center::geometry) as lon, radius, id FROM activities_privacyzone")
            for r in rows:
                uid = int(r['user_id'])
                if uid not in _privacy_zones: _privacy_zones[uid] = []
                _privacy_zones[uid].append({'lat': r['lat'], 'lon': r['lon'], 'radius': r['radius'], 'id': r['id']})
        logger.info("privacy_zones: loaded %d zones for %d users", len(rows), len(_privacy_zones))
    except Exception as e:
        logger.warning("privacy_zones: initial load skipped (table missing or empty): %s", e)

    asyncio.create_task(_traccar_redis_bridge())
    asyncio.create_task(_privacy_zones_sync())
    if queue_enabled() and not _SKIP_DB:
        start_drain_worker(await _get_ingest_redis(), _flush_insert_buffer)
    if _SKIP_DB:
        logger.info("TELEMETRY_SKIP_DB=1: ingest guard+dedupe only, DB insert disabled")
    if _SKIP_BROADCAST or _SKIP_DB:
        logger.info(
            "WebSocket broadcast disabled (TELEMETRY_SKIP_BROADCAST=%s, TELEMETRY_SKIP_DB=%s)",
            _SKIP_BROADCAST,
            _SKIP_DB,
        )
    logger.info("telemetry engine fully operational")

@app.on_event("shutdown")
async def shutdown() -> None:
    global _insert_worker_task
    await stop_drain_worker()
    if _insert_worker_task is not None:
        _insert_worker_task.cancel()
        try:
            await _insert_worker_task
        except asyncio.CancelledError:
            pass
    if _pool:
        await _pool.close()

# ---------------------------------------------------------------------------
# WebSocket Management
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self) -> None:
        self._connections: list[WebSocket] = []
    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)
    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._connections: self._connections.remove(ws)
    async def broadcast(self, payload: dict) -> None:
        if not self._connections: return
        tasks = [ws.send_json(payload) for ws in self._connections]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        dead = [ws for ws, res in zip(self._connections, results) if isinstance(res, Exception)]
        for ws in dead: self.disconnect(ws)

manager = ConnectionManager()

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

class GpsPacket(BaseModel):
    device_id: str
    user_id: int | None = None
    lat: float
    lon: float
    speed_ms: float = 0.0
    accuracy_m: float = 5.0
    activity_id: int | None = None
    timestamp: float = Field(default_factory=time.time)
    seq: int | None = None
    idempotency_key: str | None = None

class BatchPacket(BaseModel):
    packets: list[GpsPacket]
    client_batch_id: str | None = None

DEDUPE_TTL_S = int(os.getenv("TELEMETRY_DEDUPE_TTL_S", str(7 * 24 * 3600)))

try:
    _BACKFILL_WINDOW_MIN = int(os.getenv("TELEMETRY_BACKFILL_WINDOW_MIN", "30"))
except (TypeError, ValueError):
    _BACKFILL_WINDOW_MIN = 30

try:
    _BACKFILL_MAX_POINTS = int(os.getenv("TELEMETRY_BACKFILL_MAX_POINTS", "5000"))
except (TypeError, ValueError):
    _BACKFILL_MAX_POINTS = 5000

_WS_INGEST_BUFFER_MAX = max(50, int(os.getenv("TELEMETRY_WS_BUFFER_MAX", "500") or 500))

from ingest_guard import check_ingest_allowed  # noqa: E402
from ingest_queue import (  # noqa: E402
    STREAM_KEY,
    enqueue_rows as enqueue_stream_rows,
    is_queue_saturated,
    queue_enabled,
    start_drain_worker,
    stop_drain_worker,
    stream_depth,
)

_ingest_redis = None


async def _get_ingest_redis():
    global _ingest_redis
    if _ingest_redis is None:
        import redis.asyncio as redis_lib

        _ingest_redis = redis_lib.from_url(REDIS_URL, decode_responses=True)
    return _ingest_redis


def _packet_to_row(p: GpsPacket) -> tuple:
    seq = p.seq
    if seq is None and p.activity_id is not None:
        seq = int(p.timestamp * 1_000_000) % 2_147_483_647
    return (
        p.timestamp,
        p.device_id,
        p.user_id,
        p.lat,
        p.lon,
        p.speed_ms,
        p.accuracy_m,
        p.activity_id,
        seq,
    )


def _should_broadcast() -> bool:
    return not _SKIP_BROADCAST and not _SKIP_DB


async def _maybe_broadcast(payload: dict) -> None:
    if _should_broadcast():
        await manager.broadcast(payload)


def _raise_ingest_throttled(retry_after: int) -> None:
    raise HTTPException(
        status_code=429,
        detail="Telemetry ingest rate limit exceeded — retry shortly.",
        headers={
            "Retry-After": str(max(1, retry_after)),
            "X-Ingest-Mode": "throttled",
        },
    )


def _raise_system_overload(retry_after: int = 5) -> None:
    raise HTTPException(
        status_code=503,
        detail="Telemetry ingest temporarily unavailable — system capacity exceeded.",
        headers={
            "Retry-After": str(max(1, retry_after)),
            "X-Ingest-Mode": "queue-only",
        },
    )


async def _is_active_activity(activity_id: int | None) -> bool:
    """Active ride = Activity row exists with end_time IS NULL (ADR 011 §2)."""
    if not activity_id:
        return False
    cache_key = f"telemetry:active_session:{activity_id}"
    try:
        client = await _get_ingest_redis()
        cached = await client.get(cache_key)
        if cached == "1":
            return True
        if cached == "0":
            return False
    except Exception:
        client = None

    active = False
    if not _SKIP_DB:
        try:
            pool = await get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT end_time FROM activities_activity WHERE id = $1",
                    activity_id,
                )
            active = row is not None and row["end_time"] is None
        except Exception as exc:
            logger.debug("active_session.lookup_failed id=%s err=%s", activity_id, exc)
            return True  # fail-open for active-session queue path

    if client is not None:
        try:
            await client.set(cache_key, "1" if active else "0", ex=300)
        except Exception:
            pass
    return active


async def _persist_ingest_rows(
    rows: list[tuple],
    *,
    client_batch_id: str | None,
    activity_id: int | None,
    guard,
) -> dict:
    """
    Route rows to Redis Stream (engaged / throttled active session) or direct DB queue.
    Never drops rows on throttle for active sessions when queue accepts them.
    """
    if not rows:
        return {"inserted": 0, "queued": False, "ingest_mode": "direct"}

    use_stream = False
    if guard.should_queue_active_sessions and activity_id and await _is_active_activity(
        activity_id
    ):
        use_stream = True
    elif not guard.allowed:
        if activity_id and await _is_active_activity(activity_id):
            use_stream = True
        else:
            if await is_queue_saturated(await _get_ingest_redis()):
                _raise_system_overload(guard.retry_after or 5)
            _raise_ingest_throttled(guard.retry_after or 1)

    if use_stream and queue_enabled():
        client = await _get_ingest_redis()
        if await is_queue_saturated(client):
            if activity_id and await _is_active_activity(activity_id):
                _raise_system_overload(5)
            _raise_ingest_throttled(guard.retry_after or 1)
        ok = await enqueue_stream_rows(
            client,
            rows,
            client_batch_id=client_batch_id,
            activity_id=activity_id,
        )
        if ok:
            return {"inserted": len(rows), "queued": True, "ingest_mode": "stream"}
        _raise_system_overload(5)

    if not guard.allowed:
        if await is_queue_saturated(await _get_ingest_redis()):
            _raise_system_overload(guard.retry_after or 5)
        _raise_ingest_throttled(guard.retry_after or 1)

    await enqueue_gps_rows(rows)
    return {"inserted": len(rows), "queued": False, "ingest_mode": "direct"}

async def _is_duplicate_batch(client_batch_id: str | None) -> bool:
    """Redis SET NX — duplicate batch ids skip INSERT (7d TTL)."""
    if not client_batch_id:
        return False
    client = await _get_ingest_redis()
    key = f"telemetry:dedupe:{client_batch_id}"
    was_new = await client.set(key, "1", nx=True, ex=DEDUPE_TTL_S)
    return not was_new

@app.get("/api/telemetry/health")
async def health() -> dict:
    return {"status": "ok", "zones_cached": len(_privacy_zones)}

@app.post("/api/telemetry/ingest", status_code=202)
async def ingest_packet(packet: GpsPacket) -> dict:
    guard = await check_ingest_allowed(await _get_ingest_redis(), 1)

    if is_in_privacy_zone(packet.user_id, packet.lat, packet.lon):
        return {"status": "dropped_privacy"}

    result = await _persist_ingest_rows(
        [_packet_to_row(packet)],
        client_batch_id=None,
        activity_id=packet.activity_id,
        guard=guard,
    )

    await _maybe_broadcast({
        "type": "position_update",
        "device_id": packet.device_id,
        "user_id": packet.user_id,
        "lat": packet.lat,
        "lon": packet.lon,
        "speed_ms": packet.speed_ms,
        "activity_id": packet.activity_id
    })
    return {
        "status": "accepted",
        "inserted": result["inserted"],
        "queued": result["queued"],
        "ingest_mode": result["ingest_mode"],
        "acked": True,
    }

@app.post("/api/telemetry/ingest/batch", status_code=202)
async def ingest_batch(batch: BatchPacket) -> dict:
    n = len(batch.packets)
    guard = await check_ingest_allowed(await _get_ingest_redis(), max(1, n))

    if await _is_duplicate_batch(batch.client_batch_id):
        return {
            "status": "accepted",
            "inserted": 0,
            "deduped": True,
            "client_batch_id": batch.client_batch_id,
            "acked": True,
        }

    rows = []
    dropped = 0
    activity_id: int | None = None
    max_seq: int | None = None
    for p in batch.packets:
        if is_in_privacy_zone(p.user_id, p.lat, p.lon):
            dropped += 1
            continue
        rows.append(_packet_to_row(p))
        if p.activity_id is not None:
            activity_id = p.activity_id
        if p.seq is not None:
            max_seq = p.seq if max_seq is None else max(max_seq, p.seq)

    result = {"inserted": 0, "queued": False, "ingest_mode": "direct"}
    if rows:
        result = await _persist_ingest_rows(
            rows,
            client_batch_id=batch.client_batch_id,
            activity_id=activity_id,
            guard=guard,
        )
        last = batch.packets[-1]
        await _maybe_broadcast({
            "type": "position_update",
            "device_id": last.device_id,
            "user_id": last.user_id,
            "lat": last.lat,
            "lon": last.lon,
            "speed_ms": last.speed_ms,
            "activity_id": last.activity_id,
            "batch_size": len(rows)
        })

    return {
        "status": "accepted",
        "inserted": result["inserted"],
        "queued": result["queued"],
        "ingest_mode": result["ingest_mode"],
        "dropped_privacy": dropped,
        "client_batch_id": batch.client_batch_id,
        "point_count": len(rows),
        "max_seq": max_seq,
        "activity_id": activity_id,
        "acked": True,
    }


@app.post("/api/telemetry/ingest/backfill", status_code=202)
async def ingest_backfill(batch: BatchPacket, activity_id: int = Query(...)) -> dict:
    """
    Bounded post-ride GPS merge (ADR 011 §7). Only after session finished, within time window.
    """
    if not activity_id:
        raise HTTPException(status_code=400, detail="activity_id required")

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT end_time, start_time FROM activities_activity WHERE id = $1",
            activity_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="activity not found")
    if row["end_time"] is None:
        raise HTTPException(status_code=409, detail="activity still active — use live ingest")

    end_time = row["end_time"].timestamp()
    if time.time() - end_time > _BACKFILL_WINDOW_MIN * 60:
        raise HTTPException(
            status_code=410,
            detail=f"backfill window expired ({_BACKFILL_WINDOW_MIN} min)",
        )

    if len(batch.packets) > _BACKFILL_MAX_POINTS:
        raise HTTPException(
            status_code=413,
            detail=f"max {_BACKFILL_MAX_POINTS} points per backfill request",
        )

    n = len(batch.packets)
    guard = await check_ingest_allowed(await _get_ingest_redis(), max(1, n))
    if await _is_duplicate_batch(batch.client_batch_id):
        return {
            "status": "accepted",
            "inserted": 0,
            "deduped": True,
            "client_batch_id": batch.client_batch_id,
            "acked": True,
        }

    rows = []
    for p in batch.packets:
        if p.activity_id and p.activity_id != activity_id:
            continue
        if is_in_privacy_zone(p.user_id, p.lat, p.lon):
            continue
        rows.append(_packet_to_row(p))

    result = await _persist_ingest_rows(
        rows,
        client_batch_id=batch.client_batch_id,
        activity_id=activity_id,
        guard=guard,
    )
    return {
        "status": "accepted",
        "inserted": result["inserted"],
        "queued": result["queued"],
        "ingest_mode": result["ingest_mode"],
        "client_batch_id": batch.client_batch_id,
        "activity_id": activity_id,
        "acked": True,
    }


@app.get("/api/telemetry/ingest/queue/stats")
async def ingest_queue_stats() -> dict:
    """Ops: stream depth (ADR 011 P1 metrics)."""
    if not queue_enabled():
        return {"enabled": False}
    client = await _get_ingest_redis()
    depth = await stream_depth(client)
    return {"enabled": True, "stream": STREAM_KEY, "xlen": depth}

# ---------------------------------------------------------------------------
# WebSockets
# ---------------------------------------------------------------------------

@app.websocket("/ws/telemetry/live")
async def websocket_live(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            await asyncio.sleep(30)
            await ws.send_json({"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect(ws)

@app.websocket("/ws/telemetry/ingest")
async def websocket_ingest(ws: WebSocket) -> None:
    await ws.accept()
    logger.info("ws.ingest: mobile client connected")
    pending_buffer: list[dict] = []
    last_acked_seq: int | None = None
    try:
        while True:
            data = await ws.receive_json()
            if isinstance(data, dict) and data.get("type") == "ping":
                await ws.send_json({"type": "pong", "last_acked_seq": last_acked_seq})
                continue
            if isinstance(data, dict) and data.get("type") == "resume":
                last_acked_seq = data.get("last_acked_seq")
                await ws.send_json({"type": "resume_ack", "last_acked_seq": last_acked_seq})
                continue

            packets = data if isinstance(data, list) else [data]
            if not isinstance(packets, list):
                packets = [packets]

            while len(pending_buffer) >= _WS_INGEST_BUFFER_MAX:
                pending_buffer.pop(0)

            for raw in packets:
                if isinstance(raw, dict):
                    pending_buffer.append(raw)

            n = len(packets) if isinstance(packets, list) else 1
            guard = await check_ingest_allowed(await _get_ingest_redis(), max(1, n))

            rows = []
            activity_id: int | None = None
            max_seq: int | None = None
            for p in pending_buffer[-n:]:
                try:
                    pkt = GpsPacket.model_validate(p)
                    if is_in_privacy_zone(pkt.user_id, pkt.lat, pkt.lon):
                        continue
                    rows.append(_packet_to_row(pkt))
                    activity_id = pkt.activity_id or activity_id
                    if pkt.seq is not None:
                        max_seq = pkt.seq if max_seq is None else max(max_seq, pkt.seq)
                except Exception:
                    continue

            if not rows:
                continue

            try:
                result = await _persist_ingest_rows(
                    rows,
                    client_batch_id=None,
                    activity_id=activity_id,
                    guard=guard,
                )
            except HTTPException as exc:
                await ws.send_json({
                    "type": "error",
                    "status": exc.status_code,
                    "detail": exc.detail,
                    "retry_after": exc.headers.get("Retry-After", "1") if exc.headers else "1",
                })
                if exc.status_code == 429:
                    await ws.close(code=1013, reason="ingest throttled")
                elif exc.status_code == 503:
                    await ws.close(code=1013, reason="system overload")
                break

            if max_seq is not None:
                last_acked_seq = max_seq
            last = rows[-1]
            await ws.send_json({
                "type": "ack",
                "inserted": result["inserted"],
                "queued": result["queued"],
                "last_acked_seq": last_acked_seq,
            })
            await _maybe_broadcast({
                "type": "position_update",
                "device_id": last[1],
                "user_id": last[2],
                "lat": last[3],
                "lon": last[4],
                "speed_ms": last[5],
                "source": "ws_ingest",
            })
    except WebSocketDisconnect:
        logger.info("ws.ingest: mobile client disconnected")
    except Exception as e:
        logger.error("ws.ingest: unexpected error: %s", e)

# ---------------------------------------------------------------------------
# Query Endpoints (History, Live)
# ---------------------------------------------------------------------------

@app.get("/api/telemetry/live")
async def get_live_positions(device_id: str | None = None, limit: int = 50) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        if device_id:
            rows = await conn.fetch("SELECT * FROM gps_points WHERE device_id = $1 ORDER BY time DESC LIMIT $2", device_id, limit)
        else:
            rows = await conn.fetch("SELECT DISTINCT ON (device_id) * FROM gps_points ORDER BY device_id, time DESC LIMIT $1", limit)
    return [dict(r) for r in rows]

@app.get("/api/telemetry/history/{device_id}")
async def get_device_history(device_id: str, since_unix: float, until_unix: float | None = None) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        if until_unix:
            rows = await conn.fetch("SELECT * FROM gps_points WHERE device_id = $1 AND time BETWEEN to_timestamp($2) AND to_timestamp($3) ORDER BY time ASC", device_id, since_unix, until_unix)
        else:
            rows = await conn.fetch("SELECT * FROM gps_points WHERE device_id = $1 AND time >= to_timestamp($2) ORDER BY time ASC", device_id, since_unix)
    return [dict(r) for r in rows]
