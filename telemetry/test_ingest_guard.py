"""Telemetry ingest guard — packet-count semantics via ingest_guard module."""

import os
import sys
from unittest.mock import AsyncMock, MagicMock

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ingest_guard import check_ingest_allowed


@pytest.mark.asyncio
async def test_check_ingest_single_packet_one_zadd():
    mock_pipe = MagicMock()
    mock_pipe.zremrangebyscore = MagicMock(return_value=mock_pipe)
    mock_pipe.zadd = MagicMock(return_value=mock_pipe)
    mock_pipe.zcard = MagicMock(return_value=mock_pipe)
    mock_pipe.expire = MagicMock(return_value=mock_pipe)
    mock_pipe.execute = AsyncMock(return_value=[0, 1, 42, True])

    mock_client = MagicMock()
    mock_client.pipeline = MagicMock(return_value=mock_pipe)
    mock_client.get = AsyncMock(return_value=None)

    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("GLOBAL_PROTECTION_MODE", "on")
        mp.setenv("GLOBAL_MAX_INGEST_PER_SECOND", "100000")
        decision = await check_ingest_allowed(mock_client, 1)

    assert decision.allowed is True
    assert decision.count == 42
    mock_pipe.zadd.assert_called_once()


@pytest.mark.asyncio
async def test_check_ingest_throttles_when_over_cap():
    mock_pipe = MagicMock()
    mock_pipe.zremrangebyscore = MagicMock(return_value=mock_pipe)
    mock_pipe.zadd = MagicMock(return_value=mock_pipe)
    mock_pipe.zcard = MagicMock(return_value=mock_pipe)
    mock_pipe.expire = MagicMock(return_value=mock_pipe)
    mock_pipe.execute = AsyncMock(return_value=[0, 1, 25000, True])

    mock_client = MagicMock()
    mock_client.pipeline = MagicMock(return_value=mock_pipe)
    mock_client.get = AsyncMock(return_value="1")

    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("GLOBAL_PROTECTION_MODE", "on")
        mp.setenv("GLOBAL_MAX_INGEST_PER_SECOND", "20000")
        decision = await check_ingest_allowed(mock_client, 1)

    assert decision.allowed is False
    assert decision.count == 25000
    assert decision.retry_after == 1
