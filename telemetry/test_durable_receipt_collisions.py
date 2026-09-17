"""P3 collision and legacy-ACK upgrade tests for durable ingest receipts."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

import durable_routes
import ingest_service
from schemas import BatchPacket, GpsPacket


def packet(seq: int | None) -> GpsPacket:
    return GpsPacket(
        device_id="device-1",
        user_id=7,
        activity_id=42,
        lat=52.1,
        lon=21.0,
        timestamp=1_700_000_000.0 + (seq or 0),
        seq=seq,
        idempotency_key=f"42:{seq}",
    )


def disable_scope(monkeypatch) -> None:
    monkeypatch.setattr(
        durable_routes,
        "enforce_current_ingest_scope",
        lambda **_kwargs: None,
    )


@pytest.mark.asyncio
async def test_existing_receipt_payload_collision_is_not_acked(monkeypatch):
    batch = BatchPacket(
        client_batch_id="collision-batch",
        packets=[packet(1), packet(2)],
        point_count=2,
        max_seq=2,
        activity_id=42,
    )
    disable_scope(monkeypatch)
    monkeypatch.setattr(
        durable_routes,
        "get_batch_receipt",
        AsyncMock(
            return_value={
                "client_batch_id": "collision-batch",
                "activity_id": 42,
                "user_id": 7,
                "point_count": 1,
                "persisted_count": 1,
                "dropped_privacy": 0,
                "max_seq": 1,
            }
        ),
    )

    with pytest.raises(HTTPException) as exc:
        await durable_routes.ingest_batch_durable(batch)

    assert exc.value.status_code == 409
    assert "retained" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_activity_batch_without_sequence_is_rejected(monkeypatch):
    batch = BatchPacket(
        client_batch_id="missing-seq",
        packets=[packet(None)],
        point_count=1,
        activity_id=42,
    )
    disable_scope(monkeypatch)

    with pytest.raises(HTTPException) as exc:
        await durable_routes.ingest_batch_durable(batch)

    assert exc.value.status_code == 422
    assert "positive seq" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_legacy_redis_ack_is_upgraded_to_db_receipt(monkeypatch):
    batch = BatchPacket(
        client_batch_id="legacy-upgrade",
        packets=[packet(1), packet(2)],
        point_count=2,
        max_seq=2,
        activity_id=42,
    )
    rows = ingest_service.IngestRows(
        [
            ingest_service.packet_to_row(packet(1)),
            ingest_service.packet_to_row(packet(2)),
        ]
    )
    rows.point_count = 2
    rows.activity_id = 42
    rows.user_id = 7
    rows.max_seq = 2

    disable_scope(monkeypatch)
    monkeypatch.setattr(
        durable_routes,
        "get_batch_receipt",
        AsyncMock(
            return_value={
                "client_batch_id": "legacy-upgrade",
                "legacy_acked": True,
            }
        ),
    )
    monkeypatch.setattr(
        durable_routes,
        "get_ingest_redis",
        AsyncMock(return_value=object()),
    )
    monkeypatch.setattr(
        durable_routes,
        "check_ingest_allowed",
        AsyncMock(
            return_value=SimpleNamespace(
                allowed=True,
                should_queue_active_sessions=False,
                retry_after=0,
            )
        ),
    )
    monkeypatch.setattr(
        durable_routes,
        "filter_privacy_packets",
        lambda _packets: (rows, 0, 42, 2),
    )
    persist = AsyncMock(
        return_value={
            "inserted": 2,
            "queued": False,
            "ingest_mode": "direct",
        }
    )
    monkeypatch.setattr(durable_routes, "persist_ingest_rows", persist)
    monkeypatch.setattr(durable_routes, "maybe_broadcast", AsyncMock())

    response = await durable_routes.ingest_batch_durable(batch)

    assert response["acked"] is True
    persist.assert_awaited_once()
    assert persist.await_args.kwargs["receipt"] == {
        "activity_id": 42,
        "user_id": 7,
        "point_count": 2,
        "max_seq": 2,
        "dropped_privacy": 0,
    }
