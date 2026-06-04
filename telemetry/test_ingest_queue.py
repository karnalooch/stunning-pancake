"""Redis ingest queue helpers (ADR 011 PEL/DLQ)."""

import os
import sys
from unittest.mock import AsyncMock

import pytest

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

from ingest_queue import (  # noqa: E402
    _parse_row,
    _sort_rows,
    drain_once,
    queue_enabled,
    reclaim_pending,
)


def test_parse_row_normalizes_tuple():
    row = _parse_row([1.0, "dev", 7, 52.0, 21.0, 3.0, 5.0, 99, 3])
    assert row == (1.0, "dev", 7, 52.0, 21.0, 3.0, 5.0, 99, 3)


def test_sort_rows_by_activity_time_seq():
    rows = [
        (2.0, "d", 1, 0.0, 0.0, 0.0, 0.0, 10, 2),
        (1.0, "d", 1, 0.0, 0.0, 0.0, 0.0, 5, 1),
        (1.5, "d", 1, 0.0, 0.0, 0.0, 0.0, 10, 1),
    ]
    sorted_rows = _sort_rows(rows)
    assert [r[7] for r in sorted_rows] == [5, 10, 10]
    assert [r[0] for r in sorted_rows] == [1.0, 1.5, 2.0]


@pytest.mark.asyncio
async def test_drain_once_acks_after_flush():
    payload = {
        "data": '{"rows": [[1.0, "dev", 1, 52.0, 21.0, 1.0, 5.0, 42, 1]]}'
    }
    redis = AsyncMock()
    redis.xreadgroup = AsyncMock(
        return_value=[(b"telemetry:ingest:queue", [(b"1-0", payload)])]
    )
    redis.xack = AsyncMock()
    redis.xgroup_create = AsyncMock()
    flush = AsyncMock()

    inserted = await drain_once(redis, flush)
    assert inserted == 1
    flush.assert_awaited_once()
    redis.xack.assert_awaited()


@pytest.mark.asyncio
async def test_reclaim_moves_to_dlq_after_max_delivery(monkeypatch):
    monkeypatch.setattr("ingest_queue.MAX_DELIVERY_ATTEMPTS", 2)

    redis = AsyncMock()
    redis.xautoclaim = AsyncMock(return_value=("0-0", [(b"9-0", {"data": "not-json"})], []))
    redis.xpending_range = AsyncMock(
        return_value=[{"message_id": b"9-0", "times_delivered": 3}]
    )
    redis.xack = AsyncMock()
    redis.xadd = AsyncMock()
    redis.xgroup_create = AsyncMock()
    redis.xpending = AsyncMock(return_value={"pending": 0, "min": 0, "max": 0})

    from ingest_queue import reclaim_pending

    stats = await reclaim_pending(redis, AsyncMock())
    assert stats["claimed"] == 1
    assert stats["dlq"] >= 1
    redis.xadd.assert_awaited()
