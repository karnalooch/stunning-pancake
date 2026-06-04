"""Ingest routing: guard, Redis Stream queue, direct DB batch (ADR 011)."""

from __future__ import annotations

import logging

from fastapi import HTTPException

from config import DEDUPE_TTL_S, REDIS_URL, SKIP_BROADCAST, SKIP_DB
from db import enqueue_gps_rows, get_pool
from ingest_guard import check_ingest_allowed
from ingest_queue import (
    enqueue_rows as enqueue_stream_rows,
    is_queue_saturated,
    queue_enabled,
)
from privacy import is_in_privacy_zone
from schemas import GpsPacket
from ws_manager import manager

logger = logging.getLogger("telemetry")

_ingest_redis = None


async def get_ingest_redis():
    global _ingest_redis
    if _ingest_redis is None:
        import redis.asyncio as redis_lib

        _ingest_redis = redis_lib.from_url(REDIS_URL, decode_responses=True)
    return _ingest_redis


def packet_to_row(p: GpsPacket) -> tuple:
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


def should_broadcast() -> bool:
    return not SKIP_BROADCAST and not SKIP_DB


async def maybe_broadcast(payload: dict) -> None:
    if should_broadcast():
        await manager.broadcast(payload)


def raise_ingest_throttled(retry_after: int) -> None:
    raise HTTPException(
        status_code=429,
        detail="Telemetry ingest rate limit exceeded — retry shortly.",
        headers={
            "Retry-After": str(max(1, retry_after)),
            "X-Ingest-Mode": "throttled",
        },
    )


def raise_system_overload(retry_after: int = 5) -> None:
    raise HTTPException(
        status_code=503,
        detail="Telemetry ingest temporarily unavailable — system capacity exceeded.",
        headers={
            "Retry-After": str(max(1, retry_after)),
            "X-Ingest-Mode": "queue-only",
        },
    )


async def is_active_activity(activity_id: int | None) -> bool:
    if not activity_id:
        return False
    cache_key = f"telemetry:active_session:{activity_id}"
    try:
        client = await get_ingest_redis()
        cached = await client.get(cache_key)
        if cached == "1":
            return True
        if cached == "0":
            return False
    except Exception:
        client = None

    active = False
    if not SKIP_DB:
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
            return True

    if client is not None:
        try:
            await client.set(cache_key, "1" if active else "0", ex=300)
        except Exception:
            pass
    return active


async def persist_ingest_rows(
    rows: list[tuple],
    *,
    client_batch_id: str | None,
    activity_id: int | None,
    guard,
) -> dict:
    if not rows:
        return {"inserted": 0, "queued": False, "ingest_mode": "direct"}

    use_stream = False
    if guard.should_queue_active_sessions and activity_id and await is_active_activity(activity_id):
        use_stream = True
    elif not guard.allowed:
        if activity_id and await is_active_activity(activity_id):
            use_stream = True
        else:
            if await is_queue_saturated(await get_ingest_redis()):
                raise_system_overload(guard.retry_after or 5)
            raise_ingest_throttled(guard.retry_after or 1)

    if use_stream and queue_enabled():
        client = await get_ingest_redis()
        if await is_queue_saturated(client):
            if activity_id and await is_active_activity(activity_id):
                raise_system_overload(5)
            raise_ingest_throttled(guard.retry_after or 1)
        ok = await enqueue_stream_rows(
            client,
            rows,
            client_batch_id=client_batch_id,
            activity_id=activity_id,
        )
        if ok:
            return {"inserted": len(rows), "queued": True, "ingest_mode": "stream"}
        raise_system_overload(5)

    if not guard.allowed:
        if await is_queue_saturated(await get_ingest_redis()):
            raise_system_overload(guard.retry_after or 5)
        raise_ingest_throttled(guard.retry_after or 1)

    await enqueue_gps_rows(rows)
    return {"inserted": len(rows), "queued": False, "ingest_mode": "direct"}


async def is_duplicate_batch(client_batch_id: str | None) -> bool:
    if not client_batch_id:
        return False
    client = await get_ingest_redis()
    key = f"telemetry:dedupe:{client_batch_id}"
    was_new = await client.set(key, "1", nx=True, ex=DEDUPE_TTL_S)
    return not was_new


def filter_privacy_packets(
    packets: list[GpsPacket],
) -> tuple[list[tuple], int, int | None, int | None]:
    rows: list[tuple] = []
    dropped = 0
    activity_id: int | None = None
    max_seq: int | None = None
    for p in packets:
        if is_in_privacy_zone(p.user_id, p.lat, p.lon):
            dropped += 1
            continue
        rows.append(packet_to_row(p))
        if p.activity_id is not None:
            activity_id = p.activity_id
        if p.seq is not None:
            max_seq = p.seq if max_seq is None else max(max_seq, p.seq)
    return rows, dropped, activity_id, max_seq
