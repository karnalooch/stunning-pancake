"""P3 durable ingest receipt tests."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import durable_routes
import ingest_service
from schemas import BatchPacket, GpsPacket


def packet(seq: int, *, lat: float = 52.1, lon: float = 21.0) -> GpsPacket:
    return GpsPacket(
        device_id="device-1",
        user_id=7,
        activity_id=42,
        lat=lat,
        lon=lon,
        timestamp=1_700_000_000.0 + seq,
        seq=seq,
        idempotency_key=f"42:{seq}",
    )


def test_filter_keeps_receipt_metadata_when_every_point_is_private(monkeypatch):
    monkeypatch.setattr(ingest_service, "is_in_privacy_zone", lambda *_args: True)

    rows, dropped, activity_id, max_seq = ingest_service.filter_privacy_packets(
        [packet(1), packet(2)]
    )

    assert len(rows) == 0
    assert dropped == 2
    assert activity_id == 42
    assert max_seq == 2
    assert isinstance(rows, ingest_service.IngestRows)
    assert rows.point_count == 2
    assert rows.user_id == 7
    assert rows.dropped_privacy == 2
    assert rows.durable_receipt() is None


@pytest.mark.asyncio
async def test_direct_ack_persists_rows_and_fingerprinted_receipt_before_ack_marker(monkeypatch):
    rows = ingest_service.IngestRows()
    rows.extend([ingest_service.packet_to_row(packet(1)), ingest_service.packet_to_row(packet(2))])
    rows.point_count = 2
    rows.dropped_privacy = 0
    rows.activity_id = 42
    rows.user_id = 7
    rows.max_seq = 2
    rows.payload_fingerprint = "a" * 64

    persist = AsyncMock(return_value=True)
    mark = AsyncMock()
    monkeypatch.setattr(ingest_service, "persist_direct_batch_with_receipt", persist)
    monkeypatch.setattr(ingest_service, "mark_batch_acked", mark)
    monkeypatch.setattr(ingest_service, "SKIP_DB", False)

    result = await ingest_service.persist_ingest_rows(
        rows,
        client_batch_id="batch-1",
        activity_id=42,
        guard=SimpleNamespace(allowed=True, should_queue_active_sessions=False, retry_after=0),
    )

    persist.assert_awaited_once_with(
        rows,
        client_batch_id="batch-1",
        activity_id=42,
        user_id=7,
        point_count=2,
        dropped_privacy=0,
        max_seq=2,
        payload_fingerprint="a" * 64,
    )
    mark.assert_awaited_once_with("batch-1")
    assert result == {"inserted": 2, "queued": False, "ingest_mode": "direct"}


@pytest.mark.asyncio
async def test_direct_race_retry_marks_result_deduped_after_db_validation(monkeypatch):
    rows = ingest_service.IngestRows([ingest_service.packet_to_row(packet(1))])
    rows.point_count = 1
    rows.activity_id = 42
    rows.user_id = 7
    rows.max_seq = 1
    rows.payload_fingerprint = "a" * 64

    persist = AsyncMock(return_value=False)
    mark = AsyncMock()
    monkeypatch.setattr(ingest_service, "persist_direct_batch_with_receipt", persist)
    monkeypatch.setattr(ingest_service, "mark_batch_acked", mark)
    monkeypatch.setattr(ingest_service, "SKIP_DB", False)

    result = await ingest_service.persist_ingest_rows(
        rows,
        client_batch_id="batch-race",
        activity_id=42,
        guard=SimpleNamespace(allowed=True, should_queue_active_sessions=False, retry_after=0),
    )

    assert result == {
        "inserted": 1,
        "queued": False,
        "ingest_mode": "direct",
        "deduped": True,
    }
    mark.assert_awaited_once_with("batch-race")


@pytest.mark.asyncio
async def test_durable_batch_acks_fully_private_batch_without_broadcast(monkeypatch):
    value = BatchPacket(
        client_batch_id="private-batch",
        packets=[packet(1), packet(2)],
        point_count=2,
        max_seq=2,
        activity_id=42,
    )
    rows = ingest_service.IngestRows()
    rows.point_count = 2
    rows.dropped_privacy = 2
    rows.activity_id = 42
    rows.user_id = 7
    rows.max_seq = 2

    monkeypatch.setattr(durable_routes, "enforce_current_ingest_scope", lambda **_kwargs: None)
    monkeypatch.setattr(durable_routes, "get_batch_receipt", AsyncMock(return_value=None))
    monkeypatch.setattr(durable_routes, "get_ingest_redis", AsyncMock(return_value=object()))
    monkeypatch.setattr(
        durable_routes,
        "check_ingest_allowed",
        AsyncMock(return_value=SimpleNamespace(allowed=True, should_queue_active_sessions=False)),
    )
    monkeypatch.setattr(
        durable_routes,
        "filter_privacy_packets",
        lambda _packets: (rows, 2, 42, 2),
    )
    persist = AsyncMock(return_value={"inserted": 0, "queued": False, "ingest_mode": "direct"})
    monkeypatch.setattr(durable_routes, "persist_ingest_rows", persist)
    broadcast = AsyncMock()
    monkeypatch.setattr(durable_routes, "maybe_broadcast", broadcast)

    response = await durable_routes.ingest_batch_durable(value)

    assert response["acked"] is True
    assert response["inserted"] == 0
    assert response["dropped_privacy"] == 2
    assert response["max_seq"] == 2
    broadcast.assert_not_awaited()
    identity = durable_routes._activity_batch_identity(value, 42)
    assert identity is not None
    assert persist.await_args.kwargs["receipt"] == {
        **identity,
        "dropped_privacy": 2,
    }


@pytest.mark.asyncio
async def test_duplicate_batch_returns_durable_receipt_metadata(monkeypatch):
    value = BatchPacket(
        client_batch_id="duplicate-batch",
        packets=[packet(1), packet(2)],
        point_count=2,
        max_seq=2,
        activity_id=42,
    )
    identity = durable_routes._activity_batch_identity(value, 42)
    assert identity is not None
    monkeypatch.setattr(durable_routes, "enforce_current_ingest_scope", lambda **_kwargs: None)
    monkeypatch.setattr(
        durable_routes,
        "get_batch_receipt",
        AsyncMock(
            return_value={
                "client_batch_id": "duplicate-batch",
                **identity,
                "persisted_count": 1,
                "dropped_privacy": 1,
            }
        ),
    )

    response = await durable_routes.ingest_batch_durable(value)

    assert response["acked"] is True
    assert response["deduped"] is True
    assert response["inserted"] == 1
    assert response["dropped_privacy"] == 1
    assert response["max_seq"] == 2
    assert "payload_fingerprint" not in response
