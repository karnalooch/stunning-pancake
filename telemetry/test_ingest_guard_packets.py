"""Ingest guard counts len(packets), not one slot per HTTP request (ADR 011 P0)."""
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ingest_guard import check_ingest_allowed, evaluate_ingest


def test_evaluate_ingest_auto_engages_before_hard_cap():
    d = evaluate_ingest(18_000, mode="auto", limit=20_000, was_engaged=False, engage_ratio_val=0.9)
    assert d.engaged is True
    assert d.allowed is True

    d2 = evaluate_ingest(25_000, mode="auto", limit=20_000, was_engaged=True, engage_ratio_val=0.9)
    assert d2.allowed is False
    assert d2.retry_after >= 1


@pytest.mark.asyncio
async def test_check_ingest_allowed_records_n_window_slots():
    mock_pipe = MagicMock()
    mock_pipe.zremrangebyscore = MagicMock(return_value=mock_pipe)
    mock_pipe.zadd = MagicMock(return_value=mock_pipe)
    mock_pipe.zcard = MagicMock(return_value=mock_pipe)
    mock_pipe.expire = MagicMock(return_value=mock_pipe)
    mock_pipe.execute = AsyncMock(return_value=[0, 1, 10, True])

    mock_client = MagicMock()
    mock_client.pipeline = MagicMock(return_value=mock_pipe)
    mock_client.get = AsyncMock(return_value=None)
    mock_client.set = AsyncMock()

    with patch.dict(os.environ, {"GLOBAL_PROTECTION_MODE": "on", "GLOBAL_MAX_INGEST_PER_SECOND": "100000"}):
        await check_ingest_allowed(mock_client, 5)

    assert mock_pipe.zadd.call_count == 5
