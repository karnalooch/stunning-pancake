"""P3 sequence-range proof tests for durable activity telemetry."""

import pytest
from fastapi import HTTPException

import durable_routes
from schemas import BatchPacket, GpsPacket


def _packet(seq: int) -> GpsPacket:
    return GpsPacket(
        device_id="device-1",
        user_id=7,
        activity_id=42,
        lat=52.1,
        lon=21.0,
        timestamp=1_700_000_000.0 + seq,
        seq=seq,
        idempotency_key=f"42:{seq}",
    )


def test_activity_batch_rejects_noncontiguous_sequence_range():
    value = BatchPacket(
        client_batch_id="seq-gap",
        packets=[_packet(1), _packet(3)],
        point_count=2,
        max_seq=3,
        activity_id=42,
    )

    with pytest.raises(HTTPException) as exc:
        durable_routes._activity_batch_identity(value, 42)

    assert exc.value.status_code == 422
    assert "contiguous range" in str(exc.value.detail)
