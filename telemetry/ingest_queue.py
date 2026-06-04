"""
Redis Stream ingest queue — accept-and-queue under load (ADR 011 §2).

Producer: XADD with approximate MAXLEN. Consumer: XREADGROUP → Timescale batch insert.
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
    STREAM_MAXLEN = max(
        1_000, int(os.getenv("TELEMETRY_INGEST_STREAM_MAXLEN", "500000"))
    )
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

_drain_task: asyncio.Task | None = None


def queue_enabled() -> bool:
    return os.getenv("TELEMETRY_INGEST_QUEUE", "1").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


async def ensure_consumer_group(redis_client) -> None:
    try:
        await redis_client.xgroup_create(
            STREAM_KEY, CONSUMER_GROUP, id="0", mkstream=True
        )
    except Exception as exc:
        if "BUSYGROUP" not in str(exc):
            logger.debug("ingest_queue.group_create: %s", exc)


async def stream_depth(redis_client) -> int:
    try:
        return int(await redis_client.xlen(STREAM_KEY) or 0)
    except Exception:
        return 0


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

    all_rows: list[tuple] = []
    ack_ids: list[str] = []
    for _stream, messages in entries:
        for msg_id, fields in messages:
            raw = fields.get("data") or fields.get(b"data")
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            try:
                body = json.loads(raw)
                for row in body.get("rows", []):
                    parsed = _parse_row(row)
                    if parsed:
                        all_rows.append(parsed)
                ack_ids.append(msg_id)
            except Exception as exc:
                await _move_to_dlq(redis_client, msg_id, str(raw), str(exc))
                await redis_client.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)

    if not all_rows:
        return 0

    all_rows.sort(key=lambda r: (r[7] or 0, r[0], r[8] or 0))
    await flush_fn(all_rows)
    if ack_ids:
        await redis_client.xack(STREAM_KEY, CONSUMER_GROUP, *ack_ids)
    return len(all_rows)


async def _drain_loop(redis_client, flush_fn) -> None:
    while True:
        try:
            inserted = await drain_once(redis_client, flush_fn)
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
    logger.info(
        "ingest_queue.drain_started stream=%s group=%s", STREAM_KEY, CONSUMER_GROUP
    )


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
