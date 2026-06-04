"""
Redis Stream ingest queue — accept-and-queue under load (ADR 011 §2).

Producer: XADD with approximate MAXLEN. Consumer: XREADGROUP → Timescale batch insert.
PEL reclaim via XAUTOCLAIM; DLQ after MAX_DELIVERY_ATTEMPTS.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger("telemetry.ingest_queue")

STREAM_KEY = os.getenv("TELEMETRY_INGEST_STREAM", "telemetry:ingest:queue")
DLQ_STREAM_KEY = os.getenv("TELEMETRY_INGEST_DLQ", "telemetry:ingest:dead")
CONSUMER_GROUP = os.getenv("TELEMETRY_INGEST_CONSUMER_GROUP", "telemetry-drainers")
CONSUMER_NAME = os.getenv("TELEMETRY_INGEST_CONSUMER_NAME", "drain-1")

try:
    STREAM_MAXLEN = max(1_000, int(os.getenv("TELEMETRY_INGEST_STREAM_MAXLEN", "500000")))
except (TypeError, ValueError):
    STREAM_MAXLEN = 500_000

try:
    MAX_STREAM_DEPTH = int(os.getenv("TELEMETRY_INGEST_MAX_DEPTH", "400000"))
except (TypeError, ValueError):
    MAX_STREAM_DEPTH = 400_000

try:
    DRAIN_BATCH_SIZE = max(100, int(os.getenv("TELEMETRY_INGEST_DRAIN_BATCH", "2000")))
except (TypeError, ValueError):
    DRAIN_BATCH_SIZE = 2000

try:
    MAX_DELIVERY_ATTEMPTS = max(1, int(os.getenv("TELEMETRY_INGEST_MAX_DELIVERY", "5")))
except (TypeError, ValueError):
    MAX_DELIVERY_ATTEMPTS = 5

try:
    PEL_MIN_IDLE_MS = max(1_000, int(os.getenv("TELEMETRY_INGEST_PEL_IDLE_MS", "60000")))
except (TypeError, ValueError):
    PEL_MIN_IDLE_MS = 60_000

try:
    RECLAIM_INTERVAL_S = max(5.0, float(os.getenv("TELEMETRY_INGEST_RECLAIM_INTERVAL_S", "30")))
except (TypeError, ValueError):
    RECLAIM_INTERVAL_S = 30.0

_drain_task: asyncio.Task | None = None
_last_reclaim_at: float = 0.0


def queue_enabled() -> bool:
    return os.getenv("TELEMETRY_INGEST_QUEUE", "1").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


def ops_secret() -> str | None:
    secret = os.getenv("TELEMETRY_OPS_SECRET", "").strip()
    return secret or None


async def ensure_consumer_group(redis_client) -> None:
    try:
        await redis_client.xgroup_create(STREAM_KEY, CONSUMER_GROUP, id="0", mkstream=True)
    except Exception as exc:
        if "BUSYGROUP" not in str(exc):
            logger.debug("ingest_queue.group_create: %s", exc)


async def stream_depth(redis_client) -> int:
    try:
        return int(await redis_client.xlen(STREAM_KEY) or 0)
    except Exception:
        return 0


async def dlq_depth(redis_client) -> int:
    try:
        return int(await redis_client.xlen(DLQ_STREAM_KEY) or 0)
    except Exception:
        return 0


async def pending_summary(redis_client) -> dict[str, int]:
    """XPENDING summary: total pending + min/max idle (ms)."""
    try:
        pending = await redis_client.xpending(STREAM_KEY, CONSUMER_GROUP)
        if not pending:
            return {"pending": 0, "min_idle_ms": 0, "max_idle_ms": 0}
        # redis-py: {'pending': N, 'min', 'max', consumers: [...]}
        if isinstance(pending, dict):
            return {
                "pending": int(pending.get("pending", 0) or 0),
                "min_idle_ms": int(pending.get("min", 0) or 0),
                "max_idle_ms": int(pending.get("max", 0) or 0),
            }
        if isinstance(pending, (list, tuple)) and len(pending) >= 4:
            return {
                "pending": int(pending[0] or 0),
                "min_idle_ms": int(pending[1] or 0),
                "max_idle_ms": int(pending[2] or 0),
            }
    except Exception as exc:
        logger.debug("ingest_queue.xpending: %s", exc)
    return {"pending": 0, "min_idle_ms": 0, "max_idle_ms": 0}


async def is_queue_saturated(redis_client) -> bool:
    if not queue_enabled():
        return False
    return await stream_depth(redis_client) >= MAX_STREAM_DEPTH


async def enqueue_rows(
    redis_client,
    rows: list[tuple],
    *,
    client_batch_id: str | None = None,
    activity_id: int | None = None,
) -> bool:
    """Append normalized rows to the ingest stream. Returns False if saturated."""
    if not rows or not queue_enabled():
        return False
    if await is_queue_saturated(redis_client):
        return False

    payload = {
        "rows": [list(r) for r in rows],
        "client_batch_id": client_batch_id,
        "activity_id": activity_id,
        "enqueued_at": time.time(),
    }
    try:
        await redis_client.xadd(
            STREAM_KEY,
            {"data": json.dumps(payload, separators=(",", ":"))},
            maxlen=STREAM_MAXLEN,
            approximate=True,
        )
        return True
    except Exception as exc:
        logger.warning("ingest_queue.xadd_failed: %s", exc)
        return False


def _parse_row(raw: Any) -> tuple | None:
    if not isinstance(raw, (list, tuple)) or len(raw) < 8:
        return None
    seq = int(raw[8]) if len(raw) > 8 and raw[8] is not None else None
    return (
        float(raw[0]),
        str(raw[1]),
        raw[2],
        float(raw[3]),
        float(raw[4]),
        float(raw[5]),
        float(raw[6]),
        raw[7],
        seq,
    )


def _sort_rows(rows: list[tuple]) -> list[tuple]:
    return sorted(rows, key=lambda r: (r[7] or 0, r[0], r[8] or 0))


async def _delivery_count(redis_client, message_id: str) -> int:
    try:
        details = await redis_client.xpending_range(
            STREAM_KEY,
            CONSUMER_GROUP,
            min=message_id,
            max=message_id,
            count=1,
        )
        if not details:
            return 1
        entry = details[0]
        if isinstance(entry, dict):
            return int(entry.get("times_delivered", 1) or 1)
        if isinstance(entry, (list, tuple)) and len(entry) >= 4:
            return int(entry[3] or 1)
    except Exception:
        pass
    return 1


async def _move_to_dlq(redis_client, message_id: str, data: str, reason: str) -> None:
    try:
        await redis_client.xadd(
            DLQ_STREAM_KEY,
            {
                "source_id": message_id,
                "reason": reason,
                "data": data[:65536],
            },
            maxlen=50_000,
            approximate=True,
        )
    except Exception as exc:
        logger.error("ingest_queue.dlq_failed: %s", exc)


async def _process_message(
    redis_client,
    msg_id: str,
    fields: dict,
    flush_fn,
    *,
    force_dlq: bool = False,
) -> tuple[int, bool]:
    """Parse one stream message, flush rows, ACK on success. Returns (rows, acked)."""
    raw = fields.get("data") or fields.get(b"data")
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    raw_str = str(raw) if raw is not None else ""

    deliveries = await _delivery_count(redis_client, msg_id)
    if force_dlq or deliveries >= MAX_DELIVERY_ATTEMPTS:
        await _move_to_dlq(
            redis_client,
            msg_id,
            raw_str,
            f"max_delivery_attempts={deliveries}",
        )
        await redis_client.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)
        return 0, True

    try:
        body = json.loads(raw_str)
    except Exception as exc:
        await _move_to_dlq(redis_client, msg_id, raw_str, str(exc))
        await redis_client.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)
        return 0, True

    rows: list[tuple] = []
    for row in body.get("rows", []):
        parsed = _parse_row(row)
        if parsed:
            rows.append(parsed)
    if not rows:
        await redis_client.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)
        return 0, True

    try:
        await flush_fn(_sort_rows(rows))
    except Exception as exc:
        logger.error("ingest_queue.flush_failed id=%s: %s", msg_id, exc)
        return 0, False

    await redis_client.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)
    return len(rows), True


async def drain_once(redis_client, flush_fn) -> int:
    """Read one consumer batch and flush to Timescale. Returns rows inserted."""
    await ensure_consumer_group(redis_client)
    try:
        entries = await redis_client.xreadgroup(
            CONSUMER_GROUP,
            CONSUMER_NAME,
            {STREAM_KEY: ">"},
            count=DRAIN_BATCH_SIZE,
            block=100,
        )
    except Exception as exc:
        logger.debug("ingest_queue.read_failed: %s", exc)
        return 0

    if not entries:
        return 0

    inserted = 0
    for _stream, messages in entries:
        for msg_id, fields in messages:
            n, _ = await _process_message(redis_client, msg_id, fields, flush_fn)
            inserted += n
    return inserted


async def reclaim_pending(redis_client, flush_fn) -> dict[str, int]:
    """
    XAUTOCLAIM idle PEL messages and retry drain; DLQ when delivery count exceeded.
    """
    await ensure_consumer_group(redis_client)
    stats = {"claimed": 0, "reinserted": 0, "dlq": 0, "pending_left": 0}
    start_id = "0-0"
    while True:
        try:
            result = await redis_client.xautoclaim(
                STREAM_KEY,
                CONSUMER_GROUP,
                CONSUMER_NAME,
                PEL_MIN_IDLE_MS,
                start_id,
                count=100,
            )
        except Exception as exc:
            logger.warning("ingest_queue.xautoclaim_failed: %s", exc)
            break

        # redis-py 5: (next_start_id, messages, deleted_ids)
        if isinstance(result, (list, tuple)):
            if len(result) >= 2:
                start_id = result[0] or "0-0"
                messages = result[1] or []
            else:
                break
        else:
            break

        if not messages:
            break

        for msg_id, fields in messages:
            stats["claimed"] += 1
            n, acked = await _process_message(redis_client, msg_id, fields, flush_fn)
            if n > 0 and acked:
                stats["reinserted"] += n
            elif acked and n == 0:
                stats["dlq"] += 1

        if len(messages) < 100:
            break

    summary = await pending_summary(redis_client)
    stats["pending_left"] = summary["pending"]
    return stats


async def _maybe_reclaim(redis_client, flush_fn) -> None:
    global _last_reclaim_at
    if not queue_enabled():
        return
    now = time.monotonic()
    if now - _last_reclaim_at < RECLAIM_INTERVAL_S:
        return
    _last_reclaim_at = now
    stats = await reclaim_pending(redis_client, flush_fn)
    if stats["claimed"] or stats["dlq"]:
        logger.info("ingest_queue.reclaim %s", stats)


async def _drain_loop(redis_client, flush_fn) -> None:
    while True:
        try:
            inserted = await drain_once(redis_client, flush_fn)
            await _maybe_reclaim(redis_client, flush_fn)
            if inserted == 0:
                await asyncio.sleep(0.05)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("ingest_queue.drain_loop: %s", exc)
            await asyncio.sleep(1.0)


def start_drain_worker(redis_client, flush_fn) -> None:
    global _drain_task
    if not queue_enabled() or _drain_task is not None:
        return
    _drain_task = asyncio.create_task(_drain_loop(redis_client, flush_fn))
    logger.info("ingest_queue.drain_started stream=%s group=%s", STREAM_KEY, CONSUMER_GROUP)


async def stop_drain_worker() -> None:
    global _drain_task
    if _drain_task is None:
        return
    _drain_task.cancel()
    try:
        await _drain_task
    except asyncio.CancelledError:
        pass
    _drain_task = None
