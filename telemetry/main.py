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
_insert_queue: asyncio.Queue | None = None
_insert_worker_task: asyncio.Task | None = None

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
    "INSERT INTO gps_points (time, device_id, user_id, lat, lon, speed_ms, accuracy_m, activity_id) "
    "VALUES (to_timestamp($1), $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING"
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
            row = await asyncio.wait_for(_insert_queue.get(), timeout=flush_interval)
            buffer.append(row)
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
    if not rows:
        return
    if _insert_queue is None:
        _insert_queue = asyncio.Queue(maxsize=max(_INGEST_BATCH_SIZE * 20, 5000))
        _insert_worker_task = asyncio.create_task(_insert_worker())
    for row in rows:
        await _insert_queue.put(row)

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
                activity_id INTEGER
            );
        """)
        try:
            await conn.execute("SELECT create_hypertable('gps_points', 'time', if_not_exists => TRUE);")
        except: pass

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
    logger.info("telemetry engine fully operational")

@app.on_event("shutdown")
async def shutdown() -> None:
    global _insert_worker_task
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

class BatchPacket(BaseModel):
    packets: list[GpsPacket]
    client_batch_id: str | None = None

DEDUPE_TTL_S = int(os.getenv("TELEMETRY_DEDUPE_TTL_S", str(7 * 24 * 3600)))

# ---------------------------------------------------------------------------
# Always-on ingest backpressure (independent of any event)
# ---------------------------------------------------------------------------
# Mirrors backend/core/load_guard.py semantics: GLOBAL_PROTECTION_MODE=auto|on|off
# with a per-second cap. Defaults are high so normal traffic is unaffected; under
# a real 50k-device burst, excess packets get 429 + Retry-After instead of OOMing
# the DB pool. Fail-open: any Redis error allows the packet through.

def _global_protection_mode() -> str:
    val = (os.getenv("GLOBAL_PROTECTION_MODE", "auto") or "auto").strip().lower()
    if val in ("1", "true", "yes", "on", "force_on"):
        return "on"
    if val in ("0", "false", "no", "off", "force_off"):
        return "off"
    return "auto"


try:
    _INGEST_MAX_PER_SECOND = int(os.getenv("GLOBAL_MAX_INGEST_PER_SECOND", "20000"))
except (TypeError, ValueError):
    _INGEST_MAX_PER_SECOND = 20000

try:
    _INGEST_ENGAGE_RATIO = float(os.getenv("GLOBAL_PROTECTION_ENGAGE_RATIO", "0.9"))
except (TypeError, ValueError):
    _INGEST_ENGAGE_RATIO = 0.9

_INGEST_GUARD_KEY = "{global}:loadguard:ingest:sw"
_ingest_redis = None


async def _get_ingest_redis():
    global _ingest_redis
    if _ingest_redis is None:
        import redis.asyncio as redis_lib

        _ingest_redis = redis_lib.from_url(REDIS_URL, decode_responses=True)
    return _ingest_redis


async def _ingest_allowed(n: int = 1) -> tuple[bool, int, int]:
    """
    Record `n` packets in a 1s sliding window and decide if the request passes.
    Returns (allowed, count, retry_after_seconds).
    """
    mode = _global_protection_mode()
    if mode == "off" or _INGEST_MAX_PER_SECOND <= 0:
        return True, 0, 0
    now = time.time()
    try:
        client = await _get_ingest_redis()
        pipe = client.pipeline()
        pipe.zremrangebyscore(_INGEST_GUARD_KEY, 0, now - 1.0)
        for i in range(max(1, int(n))):
            pipe.zadd(_INGEST_GUARD_KEY, {f"{now}:{i}:{os.urandom(4).hex()}": now})
        pipe.zcard(_INGEST_GUARD_KEY)
        pipe.expire(_INGEST_GUARD_KEY, 5)
        results = await pipe.execute()
        count = int(results[-2] or 0)
    except Exception:
        return True, 0, 0  # fail-open

    if mode == "on":
        if count > _INGEST_MAX_PER_SECOND:
            return False, count, 1
        return True, count, 0
    # auto
    if count > _INGEST_MAX_PER_SECOND:
        return False, count, 1
    return True, count, 0


def _raise_ingest_throttled(retry_after: int) -> None:
    raise HTTPException(
        status_code=429,
        detail="Telemetry ingest rate limit exceeded — retry shortly.",
        headers={"Retry-After": str(max(1, retry_after))},
    )

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
    allowed, _count, retry_after = await _ingest_allowed(1)
    if not allowed:
        _raise_ingest_throttled(retry_after)

    if is_in_privacy_zone(packet.user_id, packet.lat, packet.lon):
        return {"status": "dropped_privacy"}

    await enqueue_gps_rows([
        (
            packet.timestamp,
            packet.device_id,
            packet.user_id,
            packet.lat,
            packet.lon,
            packet.speed_ms,
            packet.accuracy_m,
            packet.activity_id,
        )
    ])

    await manager.broadcast({
        "type": "position_update",
        "device_id": packet.device_id,
        "user_id": packet.user_id,
        "lat": packet.lat,
        "lon": packet.lon,
        "speed_ms": packet.speed_ms,
        "activity_id": packet.activity_id
    })
    return {"status": "accepted"}

@app.post("/api/telemetry/ingest/batch", status_code=202)
async def ingest_batch(batch: BatchPacket) -> dict:
    allowed, _count, retry_after = await _ingest_allowed(len(batch.packets) or 1)
    if not allowed:
        _raise_ingest_throttled(retry_after)

    if await _is_duplicate_batch(batch.client_batch_id):
        return {
            "status": "accepted",
            "inserted": 0,
            "deduped": True,
            "client_batch_id": batch.client_batch_id,
        }

    rows = []
    dropped = 0
    for p in batch.packets:
        if is_in_privacy_zone(p.user_id, p.lat, p.lon):
            dropped += 1
            continue
        rows.append((p.timestamp, p.device_id, p.user_id, p.lat, p.lon, p.speed_ms, p.accuracy_m, p.activity_id))
    
    if rows:
        await enqueue_gps_rows(rows)
        last = batch.packets[-1]
        await manager.broadcast({
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
        "inserted": len(rows),
        "dropped_privacy": dropped,
        "client_batch_id": batch.client_batch_id,
    }

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
    try:
        while True:
            data = await ws.receive_json()
            packets = data if isinstance(data, list) else [data]
            rows = []
            for p in packets:
                try:
                    uid = p.get("user_id")
                    lat, lon = float(p["lat"]), float(p["lon"])
                    
                    if is_in_privacy_zone(uid, lat, lon):
                        continue
                    
                    rows.append((
                        float(p.get("timestamp", time.time())),
                        str(p["device_id"]),
                        uid,
                        lat, lon,
                        float(p.get("speed_ms", 0)),
                        5.0,
                        p.get("activity_id")
                    ))
                except: continue

            if rows:
                await enqueue_gps_rows(rows)
                # Broadcast the latest
                last = rows[-1]
                await manager.broadcast({
                    "type": "position_update",
                    "device_id": last[1],
                    "user_id": last[2],
                    "lat": last[3],
                    "lon": last[4],
                    "speed_ms": last[5],
                    "source": "ws_ingest"
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
