"""Background Redis bridges (Traccar ingest, privacy zone pub/sub)."""

from __future__ import annotations

import asyncio
import json
import logging
import time

from config import INGEST_BATCH_SIZE, REDIS_URL, TRACCAR_CHANNEL
from db import get_pool
from ws_manager import manager

logger = logging.getLogger("telemetry")


async def traccar_redis_bridge() -> None:
    import redis.asyncio as redis_lib

    batch_buffer: list[tuple] = []
    max_batch = INGEST_BATCH_SIZE
    last_flush = time.time()
    client = redis_lib.from_url(REDIS_URL, decode_responses=True)

    while True:
        try:
            async with client.pubsub() as pubsub:
                await pubsub.subscribe(TRACCAR_CHANNEL)
                async for message in pubsub.listen():
                    if message["type"] != "message":
                        continue
                    try:
                        data = (
                            json.loads(message["data"])
                            if isinstance(message["data"], str)
                            else message["data"]
                        )
                        device_id = str(data.get("deviceId", "unknown"))
                        lat = float(data.get("latitude", 0))
                        lon = float(data.get("longitude", 0))
                        speed_ms = float(data.get("speed", 0)) * 0.514444
                        ts = float(data.get("fixTime", time.time() * 1000)) / 1000.0

                        batch_buffer.append((ts, device_id, lat, lon, speed_ms))

                        if len(batch_buffer) >= max_batch or (time.time() - last_flush > 2.0):
                            if batch_buffer:
                                pool = await get_pool()
                                async with pool.acquire() as conn:
                                    await conn.executemany(
                                        "INSERT INTO gps_points (time, device_id, lat, lon, speed_ms) "
                                        "VALUES (to_timestamp($1), $2, $3, $4, $5) ON CONFLICT DO NOTHING",
                                        batch_buffer,
                                    )
                                batch_buffer = []
                                last_flush = time.time()

                        await manager.broadcast(
                            {
                                "type": "position_update",
                                "device_id": device_id,
                                "lat": lat,
                                "lon": lon,
                                "speed_ms": round(speed_ms, 2),
                                "ts": ts,
                                "source": "traccar_bridge",
                            }
                        )
                    except Exception as exc:
                        logger.warning("traccar_bridge: skip malformed packet: %s", exc)
        except Exception as exc:
            logger.error("traccar_bridge: error: %s", exc)
            await asyncio.sleep(5)
