"""TimescaleDB pool and batched GPS insert queue."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import UTC, datetime

import asyncpg

from config import (
    DB_DSN,
    DB_POOL_MAX,
    DB_POOL_MIN,
    INGEST_BATCH_SIZE,
    INGEST_FLUSH_MS,
    INSERT_SQL,
    SKIP_DB,
)

DRAIN_USE_COPY = os.getenv("TELEMETRY_DRAIN_USE_COPY", "").strip().lower() in (
    "1",
    "true",
    "yes",
)

logger = logging.getLogger("telemetry")

_pool: asyncpg.Pool | None = None
_insert_queue: asyncio.Queue[list[tuple]] | None = None
_insert_worker_task: asyncio.Task | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DB_DSN,
            min_size=DB_POOL_MIN,
            max_size=DB_POOL_MAX,
            command_timeout=30,
        )
        logger.info(
            "db.pool ready min=%d max=%d batch=%d",
            DB_POOL_MIN,
            DB_POOL_MAX,
            INGEST_BATCH_SIZE,
        )
    return _pool


def _sort_rows(rows: list[tuple]) -> list[tuple]:
    return sorted(rows, key=lambda r: (r[7] or 0, r[0], r[8] or 0))


def _rows_for_copy(rows: list[tuple]) -> list[tuple]:
    out: list[tuple] = []
    for r in rows:
        out.append(
            (
                datetime.fromtimestamp(float(r[0]), tz=UTC),
                r[1],
                r[2],
                float(r[3]),
                float(r[4]),
                float(r[5]),
                float(r[6]),
                r[7],
                r[8],
            )
        )
    return out


async def flush_insert_buffer(rows: list[tuple]) -> None:
    if not rows:
        return
    rows = _sort_rows(rows)
    pool = await get_pool()
    async with pool.acquire() as conn:
        if DRAIN_USE_COPY:
            await conn.copy_records_to_table(
                "gps_points",
                records=_rows_for_copy(rows),
                columns=[
                    "time",
                    "device_id",
                    "user_id",
                    "lat",
                    "lon",
                    "speed_ms",
                    "accuracy_m",
                    "activity_id",
                    "seq",
                ],
            )
        else:
            await conn.executemany(INSERT_SQL, rows)


async def _insert_worker() -> None:
    assert _insert_queue is not None
    buffer: list[tuple] = []
    flush_interval = INGEST_FLUSH_MS / 1000.0
    while True:
        try:
            chunk = await asyncio.wait_for(_insert_queue.get(), timeout=flush_interval)
            buffer.extend(chunk)
            _insert_queue.task_done()
        except TimeoutError:
            pass
        except asyncio.CancelledError:
            if buffer:
                await flush_insert_buffer(buffer)
            raise

        if len(buffer) >= INGEST_BATCH_SIZE:
            batch = buffer
            buffer = []
            await flush_insert_buffer(batch)


async def enqueue_gps_rows(rows: list[tuple]) -> None:
    global _insert_queue, _insert_worker_task
    if not rows or SKIP_DB:
        return
    if _insert_queue is None:
        _insert_queue = asyncio.Queue(maxsize=max(INGEST_BATCH_SIZE * 20, 500))
        _insert_worker_task = asyncio.create_task(_insert_worker())
    while True:
        try:
            _insert_queue.put_nowait(rows)
            return
        except asyncio.QueueFull:
            await asyncio.sleep(0.001)


async def close_pool() -> None:
    global _insert_worker_task, _pool
    if _insert_worker_task is not None:
        _insert_worker_task.cancel()
        try:
            await _insert_worker_task
        except asyncio.CancelledError:
            pass
        _insert_worker_task = None
    if _pool:
        await _pool.close()
        _pool = None
