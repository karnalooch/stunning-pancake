"""P3 immutable payload collision and durable receipt race tests."""

from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

import db
import durable_routes
import ingest_service
from schemas import BatchPacket, GpsPacket


def packet(
    seq: int | None,
    *,
    lat: float = 52.1,
    lon: float = 21.0,
    timestamp: float | None = None,
    speed_ms: float = 0.0,
    idempotency_key: str | None = None,
) -> GpsPacket:
    return GpsPacket(
        device_id="device-1",
        user_id=7,
        activity_id=42,
        lat=lat,
        lon=lon,
        altitude_m=123.4,
        speed_ms=speed_ms,
        accuracy_m=3.5,
        timestamp=timestamp if timestamp is not None else 1_700_000_000.0 + (seq or 0),
        seq=seq,
        idempotency_key=idempotency_key or f"42:{seq}",
        segment_break=False,
    )


def batch(
    client_batch_id: str,
    packets: list[GpsPacket] | None = None,
) -> BatchPacket:
    packet_list = packets or [packet(1), packet(2)]
    concrete_seqs = [p.seq for p in packet_list if p.seq is not None]
    return BatchPacket(
        client_batch_id=client_batch_id,
        packets=packet_list,
        point_count=len(packet_list),
        max_seq=max(concrete_seqs) if concrete_seqs else None,
        activity_id=42,
    )


def receipt_for(
    value: BatchPacket,
    *,
    persisted_count: int | None = None,
    dropped_privacy: int = 0,
) -> dict:
    identity = durable_routes._activity_batch_identity(value, 42)
    assert identity is not None
    if persisted_count is None:
        persisted_count = len(value.packets) - dropped_privacy
    return {
        "client_batch_id": value.client_batch_id,
        **identity,
        "persisted_count": persisted_count,
        "dropped_privacy": dropped_privacy,
    }


def disable_scope(monkeypatch) -> None:
    monkeypatch.setattr(
        durable_routes,
        "enforce_current_ingest_scope",
        lambda **_kwargs: None,
    )


def install_early_collision_spies(monkeypatch, existing: dict) -> tuple[AsyncMock, AsyncMock]:
    monkeypatch.setattr(
        durable_routes,
        "get_batch_receipt",
        AsyncMock(return_value=existing),
    )
    persist = AsyncMock()
    broadcast = AsyncMock()
    monkeypatch.setattr(durable_routes, "persist_ingest_rows", persist)
    monkeypatch.setattr(durable_routes, "maybe_broadcast", broadcast)
    return persist, broadcast


@pytest.mark.asyncio
async def test_exact_retry_same_payload_is_deduped_and_acked(monkeypatch):
    original = batch("exact-retry")
    disable_scope(monkeypatch)
    persist, broadcast = install_early_collision_spies(monkeypatch, receipt_for(original))

    response = await durable_routes.ingest_batch_durable(original)

    assert response["acked"] is True
    assert response["deduped"] is True
    assert response["client_batch_id"] == "exact-retry"
    persist.assert_not_awaited()
    broadcast.assert_not_awaited()


@pytest.mark.asyncio
async def test_coordinate_only_collision_returns_409_without_ack_or_side_effects(monkeypatch):
    original = batch("coordinate-collision")
    changed = batch(
        "coordinate-collision",
        [packet(1), packet(2, lon=21.0001)],
    )
    disable_scope(monkeypatch)
    persist, broadcast = install_early_collision_spies(monkeypatch, receipt_for(original))

    with pytest.raises(HTTPException) as exc:
        await durable_routes.ingest_batch_durable(changed)

    assert exc.value.status_code == 409
    assert "retained" in str(exc.value.detail)
    persist.assert_not_awaited()
    broadcast.assert_not_awaited()


@pytest.mark.asyncio
async def test_sequence_order_collision_with_same_count_and_max_seq_returns_409(monkeypatch):
    original = batch(
        "sequence-collision",
        [
            packet(1, idempotency_key="slot-a"),
            packet(2, idempotency_key="slot-b"),
            packet(3, idempotency_key="slot-c"),
        ],
    )
    changed = batch(
        "sequence-collision",
        [
            packet(2, idempotency_key="slot-b"),
            packet(1, idempotency_key="slot-a"),
            packet(3, idempotency_key="slot-c"),
        ],
    )
    assert original.point_count == changed.point_count == 3
    assert original.max_seq == changed.max_seq == 3
    disable_scope(monkeypatch)
    persist, broadcast = install_early_collision_spies(monkeypatch, receipt_for(original))

    with pytest.raises(HTTPException) as exc:
        await durable_routes.ingest_batch_durable(changed)

    assert exc.value.status_code == 409
    persist.assert_not_awaited()
    broadcast.assert_not_awaited()


@pytest.mark.asyncio
async def test_timestamp_collision_with_same_basic_metadata_returns_409(monkeypatch):
    original = batch("timestamp-collision")
    changed = batch(
        "timestamp-collision",
        [packet(1), packet(2, timestamp=1_700_000_002.5)],
    )
    disable_scope(monkeypatch)
    persist, broadcast = install_early_collision_spies(monkeypatch, receipt_for(original))

    with pytest.raises(HTTPException) as exc:
        await durable_routes.ingest_batch_durable(changed)

    assert exc.value.status_code == 409
    persist.assert_not_awaited()
    broadcast.assert_not_awaited()


@pytest.mark.asyncio
async def test_fully_private_exact_retry_dedupes_but_changed_payload_is_not_acked(monkeypatch):
    original = batch("private-retry")
    existing = receipt_for(original, persisted_count=0, dropped_privacy=2)
    disable_scope(monkeypatch)
    persist, broadcast = install_early_collision_spies(monkeypatch, existing)

    exact = await durable_routes.ingest_batch_durable(original)

    assert exact["acked"] is True
    assert exact["deduped"] is True
    assert exact["inserted"] == 0
    assert exact["dropped_privacy"] == 2
    persist.assert_not_awaited()
    broadcast.assert_not_awaited()

    changed = batch("private-retry", [packet(1, lat=52.1001), packet(2)])
    with pytest.raises(HTTPException) as exc:
        await durable_routes.ingest_batch_durable(changed)

    assert exc.value.status_code == 409
    persist.assert_not_awaited()
    broadcast.assert_not_awaited()


@pytest.mark.asyncio
async def test_fingerprintless_historical_receipt_fails_closed(monkeypatch):
    original = batch("historical-receipt")
    existing = receipt_for(original)
    existing["payload_fingerprint"] = None
    disable_scope(monkeypatch)
    persist, broadcast = install_early_collision_spies(monkeypatch, existing)

    with pytest.raises(HTTPException) as exc:
        await durable_routes.ingest_batch_durable(original)

    assert exc.value.status_code == 409
    persist.assert_not_awaited()
    broadcast.assert_not_awaited()


@pytest.mark.asyncio
async def test_activity_bound_legacy_ack_fails_closed_without_new_durable_ack(monkeypatch):
    original = batch("legacy-activity-ack")
    disable_scope(monkeypatch)
    persist, broadcast = install_early_collision_spies(
        monkeypatch,
        {
            "client_batch_id": original.client_batch_id,
            "legacy_acked": True,
        },
    )

    with pytest.raises(HTTPException) as exc:
        await durable_routes.ingest_batch_durable(original)

    assert exc.value.status_code == 409
    persist.assert_not_awaited()
    broadcast.assert_not_awaited()


@pytest.mark.asyncio
async def test_activity_batch_without_sequence_is_rejected(monkeypatch):
    value = BatchPacket(
        client_batch_id="missing-seq",
        packets=[packet(None)],
        point_count=1,
        activity_id=42,
    )
    disable_scope(monkeypatch)

    with pytest.raises(HTTPException) as exc:
        await durable_routes.ingest_batch_durable(value)

    assert exc.value.status_code == 422
    assert "positive seq" in str(exc.value.detail)


class _AsyncContext:
    def __init__(self, value):
        self.value = value

    async def __aenter__(self):
        return self.value

    async def __aexit__(self, _exc_type, _exc, _tb):
        return False


class _FakeConnection:
    def __init__(self, existing: dict):
        self.fetchrow = AsyncMock(side_effect=[None, existing])
        self.executemany = AsyncMock()

    def transaction(self):
        return _AsyncContext(self)


class _FakePool:
    def __init__(self, conn: _FakeConnection):
        self.conn = conn

    def acquire(self):
        return _AsyncContext(self.conn)


def _db_existing_receipt(payload_fingerprint: str | None) -> dict:
    return {
        "activity_id": 42,
        "user_id": 7,
        "point_count": 1,
        "persisted_count": 1,
        "dropped_privacy": 0,
        "max_seq": 1,
        "payload_fingerprint": payload_fingerprint,
    }


@pytest.mark.asyncio
async def test_db_conflict_race_same_fingerprint_is_safe_retry_without_new_rows(monkeypatch):
    fingerprint = "a" * 64
    conn = _FakeConnection(_db_existing_receipt(fingerprint))
    monkeypatch.setattr(db, "get_pool", AsyncMock(return_value=_FakePool(conn)))
    rows = [ingest_service.packet_to_row(packet(1))]

    created = await db.persist_direct_batch_with_receipt(
        rows,
        client_batch_id="race-exact",
        activity_id=42,
        user_id=7,
        point_count=1,
        dropped_privacy=0,
        max_seq=1,
        payload_fingerprint=fingerprint,
    )

    assert created is False
    conn.executemany.assert_not_awaited()


@pytest.mark.asyncio
async def test_db_conflict_race_different_fingerprint_raises_before_new_rows(monkeypatch):
    conn = _FakeConnection(_db_existing_receipt("b" * 64))
    monkeypatch.setattr(db, "get_pool", AsyncMock(return_value=_FakePool(conn)))
    rows = [ingest_service.packet_to_row(packet(1))]

    with pytest.raises(db.ReceiptCollisionError):
        await db.persist_direct_batch_with_receipt(
            rows,
            client_batch_id="race-collision",
            activity_id=42,
            user_id=7,
            point_count=1,
            dropped_privacy=0,
            max_seq=1,
            payload_fingerprint="a" * 64,
        )

    conn.executemany.assert_not_awaited()


@pytest.mark.asyncio
async def test_db_conflict_race_fingerprintless_receipt_fails_closed(monkeypatch):
    conn = _FakeConnection(_db_existing_receipt(None))
    monkeypatch.setattr(db, "get_pool", AsyncMock(return_value=_FakePool(conn)))
    rows = [ingest_service.packet_to_row(packet(1))]

    with pytest.raises(db.ReceiptCollisionError):
        await db.persist_direct_batch_with_receipt(
            rows,
            client_batch_id="race-historical",
            activity_id=42,
            user_id=7,
            point_count=1,
            dropped_privacy=0,
            max_seq=1,
            payload_fingerprint="a" * 64,
        )

    conn.executemany.assert_not_awaited()
