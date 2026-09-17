"""Telemetry batch ingest dedupe and ACK lifecycle."""

import os
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

from durable_routes import _activity_batch_identity
from ingest_service import is_duplicate_batch, persist_ingest_rows
from main import BatchPacket, GpsPacket, ingest_batch


@pytest.mark.asyncio
async def test_is_duplicate_batch_prefers_durable_receipt_then_legacy_marker():
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=None)
    fetch_receipt = AsyncMock(
        side_effect=[
            None,
            {
                "client_batch_id": "batch-uuid-1",
                "activity_id": 42,
                "user_id": 1,
                "point_count": 1,
                "persisted_count": 1,
                "dropped_privacy": 0,
                "max_seq": 1,
            },
        ]
    )

    with (
        patch("ingest_service.fetch_ingest_receipt", fetch_receipt),
        patch("ingest_service.get_ingest_redis", AsyncMock(return_value=mock_client)),
    ):
        assert await is_duplicate_batch("batch-uuid-1") is False
        assert await is_duplicate_batch("batch-uuid-1") is True

    assert mock_client.get.await_count == 1
    assert fetch_receipt.await_count == 2


@pytest.mark.asyncio
async def test_direct_persist_marks_ack_only_after_database_write():
    events: list[str] = []

    async def flush(_rows):
        events.append("persist")

    async def mark(_batch_id):
        events.append("ack")

    guard = SimpleNamespace(allowed=True, should_queue_active_sessions=False, retry_after=None)
    with (
        patch("ingest_service.SKIP_DB", False),
        patch("ingest_service.flush_insert_buffer", flush),
        patch("ingest_service.mark_batch_acked", mark),
    ):
        result = await persist_ingest_rows(
            [(1.0, "d1", 1, 52.0, 21.0, 0.0, 5.0, 42, 1)],
            client_batch_id="batch-1",
            activity_id=42,
            guard=guard,
        )

    assert result["inserted"] == 1
    assert events == ["persist", "ack"]


@pytest.mark.asyncio
async def test_failed_persist_does_not_create_false_duplicate_ack():
    guard = SimpleNamespace(allowed=True, should_queue_active_sessions=False, retry_after=None)
    mark = AsyncMock()

    with (
        patch("ingest_service.SKIP_DB", False),
        patch("ingest_service.flush_insert_buffer", AsyncMock(side_effect=RuntimeError("db down"))),
        patch("ingest_service.mark_batch_acked", mark),
    ):
        with pytest.raises(RuntimeError, match="db down"):
            await persist_ingest_rows(
                [(1.0, "d1", 1, 52.0, 21.0, 0.0, 5.0, 42, 1)],
                client_batch_id="batch-fail",
                activity_id=42,
                guard=guard,
            )

    mark.assert_not_awaited()


@pytest.mark.asyncio
async def test_ingest_batch_returns_durable_receipt_when_deduped():
    batch = BatchPacket(
        client_batch_id="dup-id",
        point_count=1,
        activity_id=42,
        max_seq=1,
        packets=[
            GpsPacket(
                device_id="d1",
                user_id=1,
                activity_id=42,
                lat=52.0,
                lon=21.0,
                seq=1,
            ),
        ],
    )
    identity = _activity_batch_identity(batch, 42)
    assert identity is not None
    receipt = {
        "client_batch_id": "dup-id",
        **identity,
        "persisted_count": 1,
        "dropped_privacy": 0,
    }
    with patch("durable_routes.get_batch_receipt", AsyncMock(return_value=receipt)):
        result = await ingest_batch(batch)
    assert result["deduped"] is True
    assert result["inserted"] == 1
    assert result["point_count"] == 1
    assert result["acked"] is True
