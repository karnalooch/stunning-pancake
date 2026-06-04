"""Telemetry batch ingest dedupe (Redis SET NX)."""

import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

from main import BatchPacket, GpsPacket, _is_duplicate_batch, ingest_batch


@pytest.mark.asyncio
async def test_is_duplicate_batch_first_call_not_duplicate():
    mock_client = AsyncMock()
    mock_client.set = AsyncMock(return_value=True)
    mock_client.aclose = AsyncMock()

    with patch("redis.asyncio.from_url", return_value=mock_client):
        dup = await _is_duplicate_batch("batch-uuid-1")
    assert dup is False
    mock_client.set.assert_awaited_once()
    assert "telemetry:dedupe:batch-uuid-1" in mock_client.set.await_args[0][0]


@pytest.mark.asyncio
async def test_ingest_batch_skips_insert_when_deduped():
    with patch("routes.is_duplicate_batch", AsyncMock(return_value=True)):
        result = await ingest_batch(
            BatchPacket(
                client_batch_id="dup-id",
                packets=[
                    GpsPacket(device_id="d1", lat=52.0, lon=21.0),
                ],
            ),
        )
    assert result["deduped"] is True
    assert result["inserted"] == 0
