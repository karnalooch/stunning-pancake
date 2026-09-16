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
    assert rows.durable_receipt() == {
        "activity_id": 42,
        "user_id": 7,
        "point_count": 2,
        "dropped_privacy": 2,
        "max_seq": 2,
    }


@pytest.mark.asyncio
async def test_direct_ack_persists_rows_and_receipt_before_ack_marker(monkeypatch):
    rows = ingest_service.IngestRows()
    rows.extend([ingest_service.packet_to_row(packet(1)), ingest_service.packet_to_row(packet(2))])
    rows.point_count = 2
    rows.dropped_privacy = 0
    rows.activity_id = 42
    rows.user_id = 7
    rows.max_seq = 2

    persist = AsyncMock()
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
    )
    mark.assert_awaited_once_with("batch-1")
    assert result == {"inserted": 2, "queued": False, "ingest_mode": "direct"}


@pytest.mark.asyncio
async def test_durable_batch_acks_fully_private_batch_without_broadcast(monkeypatch):
    batch = BatchPacket(
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
    monkeypatch.setattr(
        durable_routes,
        "persist_ingest_rows",
        AsyncMock(return_value={"inserted": 0, "queued": False, "ingest_mode": "direct"}),
    )
    broadcast = AsyncMock()
    monkeypatch.setattr(durable_routes, "maybe_broadcast", broadcast)

    response = await durable_routes.ingest_batch_durable(batch)

    assert response["acked"] is True
    assert response["inserted"] == 0
    assert response["dropped_privacy"] == 2
    assert response["max_seq"] == 2
    broadcast.assert_not_awaited()


@pytest.mark.asyncio
async def test_duplicate_batch_returns_durable_receipt_metadata(monkeypatch):
    batch = BatchPacket(
        client_batch_id="duplicate-batch",
        packets=[packet(1), packet(2)],
        point_count=2,
        max_seq=2,
        activity_id=42,
    )
    monkeypatch.setattr(durable_routes, "enforce_current_ingest_scope", lambda **_kwargs: None)
    monkeypatch.setattr(
        durable_routes,
        "get_batch_receipt",
        AsyncMock(
            return_value={
                "client_batch_id": "duplicate-batch",
                "activity_id": 42,
                "user_id": 7,
                "point_count": 2,
                "persisted_count": 1,
                "dropped_privacy": 1,
                "max_seq": 2,
            }
        ),
    )

    response = await durable_routes.ingest_batch_durable(batch)

    assert response["acked"] is True
    assert response["deduped"] is True
    assert response["inserted"] == 1
    assert response["dropped_privacy"] == 1
    assert response["max_seq"] == 2
