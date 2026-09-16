"""Ingest routing: guard, Redis Stream queue, direct DB batch (ADR 011)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException

from config import DEDUPE_TTL_S, REDIS_URL, SKIP_BROADCAST, SKIP_DB
from db import (
    fetch_ingest_receipt,
    flush_insert_buffer,
    get_pool,
    persist_direct_batch_with_receipt,
)
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


class IngestRows(list[tuple]):
    """Public DB rows plus proof metadata for the original client batch."""

    point_count: int = 0
    dropped_privacy: int = 0
    activity_id: int | None = None
    user_id: int | None = None
    max_seq: int | None = None

    def durable_receipt(self) -> dict[str, int] | None:
        if (
            self.point_count <= 0
            or self.activity_id is None
            or self.user_id is None
            or self.max_seq is None
        ):
            return None
        return {
            "activity_id": self.activity_id,
            "user_id": self.user_id,
            "point_count": self.point_count,
            "dropped_privacy": self.dropped_privacy,
            "max_seq": self.max_seq,
        }


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


async def mark_batch_acked(client_batch_id: str | None) -> None:
    if not client_batch_id:
        return
    client = await get_ingest_redis()
    await client.set(
        f"telemetry:dedupe:{client_batch_id}",
        "acked",
        ex=DEDUPE_TTL_S,
    )


async def persist_ingest_rows(
    rows: list[tuple],
    *,
    client_batch_id: str | None,
    activity_id: int | None,
    guard,
    receipt: dict[str, int] | None = None,
) -> dict:
    if receipt is None and isinstance(rows, IngestRows):
        receipt = rows.durable_receipt()

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
        if not rows:
            # A fully privacy-dropped batch cannot be represented faithfully in
            # the legacy stream payload. Pilot mode disables this queue; fail
            # closed instead of inventing a durable receipt.
            raise_system_overload(5)
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
            await mark_batch_acked(client_batch_id)
            return {"inserted": len(rows), "queued": True, "ingest_mode": "stream"}
        raise_system_overload(5)

    if not guard.allowed:
        if await is_queue_saturated(await get_ingest_redis()):
            raise_system_overload(guard.retry_after or 5)
        raise_ingest_throttled(guard.retry_after or 1)

    # Direct-mode ACK is emitted only after one PostgreSQL transaction commits
    # both the public GPS rows and the durable batch receipt used by P3 route
    # reconciliation. This makes the ACK independently auditable server-side.
    if not SKIP_DB:
        if receipt is not None and client_batch_id is not None:
            await persist_direct_batch_with_receipt(
                rows,
                client_batch_id=client_batch_id,
                activity_id=receipt["activity_id"],
                user_id=receipt["user_id"],
                point_count=receipt["point_count"],
                dropped_privacy=receipt["dropped_privacy"],
                max_seq=receipt["max_seq"],
            )
        elif rows:
            await flush_insert_buffer(rows)
    await mark_batch_acked(client_batch_id)
    return {"inserted": len(rows), "queued": False, "ingest_mode": "direct"}


async def get_batch_receipt(client_batch_id: str | None) -> dict[str, Any] | None:
    """Resolve a durable dedupe receipt, preferring PostgreSQL evidence."""

    if not client_batch_id:
        return None
    receipt = await fetch_ingest_receipt(client_batch_id)
    if receipt is not None:
        return receipt
    client = await get_ingest_redis()
    value = await client.get(f"telemetry:dedupe:{client_batch_id}")
    if value == "acked":
        return {"client_batch_id": client_batch_id, "legacy_acked": True}
    return None


async def is_duplicate_batch(client_batch_id: str | None) -> bool:
    return await get_batch_receipt(client_batch_id) is not None


def filter_privacy_packets(
    packets: list[GpsPacket],
) -> tuple[list[tuple], int, int | None, int | None]:
    rows = IngestRows()
    rows.point_count = len(packets)
    user_ids = {p.user_id for p in packets if p.user_id is not None}
    if len(user_ids) == 1:
        rows.user_id = next(iter(user_ids))

    for p in packets:
        if p.activity_id is not None:
            rows.activity_id = p.activity_id
        if p.seq is not None:
            rows.max_seq = p.seq if rows.max_seq is None else max(rows.max_seq, p.seq)
        if is_in_privacy_zone(p.user_id, p.lat, p.lon):
            rows.dropped_privacy += 1
            continue
        rows.append(packet_to_row(p))

    return rows, rows.dropped_privacy, rows.activity_id, rows.max_seq
