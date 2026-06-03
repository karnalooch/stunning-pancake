"""Telemetry ingest guard — one Redis ZADD per request."""
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from main import _ingest_allowed


@pytest.mark.asyncio
async def test_ingest_allowed_single_zadd_per_request():
    """Batch and single ingest share one sliding-window slot (1 ZADD, not N)."""
    mock_pipe = MagicMock()
    mock_pipe.zremrangebyscore = MagicMock(return_value=mock_pipe)
    mock_pipe.zadd = MagicMock(return_value=mock_pipe)
    mock_pipe.zcard = MagicMock(return_value=mock_pipe)
    mock_pipe.expire = MagicMock(return_value=mock_pipe)
    mock_pipe.execute = AsyncMock(return_value=[0, 1, 42, True])

    mock_client = MagicMock()
    mock_client.pipeline = MagicMock(return_value=mock_pipe)

    with patch.dict(os.environ, {"GLOBAL_PROTECTION_MODE": "on", "GLOBAL_MAX_INGEST_PER_SECOND": "100000"}):
        with patch("main._get_ingest_redis", AsyncMock(return_value=mock_client)):
            allowed, count, retry_after = await _ingest_allowed()

    assert allowed is True
    assert count == 42
    assert retry_after == 0
    mock_pipe.zadd.assert_called_once()


@pytest.mark.asyncio
async def test_ingest_allowed_throttles_when_over_cap():
    mock_pipe = MagicMock()
    mock_pipe.zremrangebyscore = MagicMock(return_value=mock_pipe)
    mock_pipe.zadd = MagicMock(return_value=mock_pipe)
    mock_pipe.zcard = MagicMock(return_value=mock_pipe)
    mock_pipe.expire = MagicMock(return_value=mock_pipe)
    mock_pipe.execute = AsyncMock(return_value=[0, 1, 25000, True])

    mock_client = MagicMock()
    mock_client.pipeline = MagicMock(return_value=mock_pipe)

    with patch.dict(os.environ, {"GLOBAL_PROTECTION_MODE": "on", "GLOBAL_MAX_INGEST_PER_SECOND": "20000"}):
        with patch("main._get_ingest_redis", AsyncMock(return_value=mock_client)):
            allowed, count, retry_after = await _ingest_allowed()

    assert allowed is False
    assert count == 25000
    assert retry_after == 1
