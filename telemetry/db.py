"""TimescaleDB pool and batched GPS insert queue."""

from __future__ import annotations

import asyncio
import logging

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


async def flush_insert_buffer(rows: list[tuple]) -> None:
    if not rows:
        return
    pool = await get_pool()
    async with pool.acquire() as conn:
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
