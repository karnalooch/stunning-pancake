"""Pilot telemetry packet/batch contract validation."""

import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

from schemas import MAX_INGEST_BATCH_POINTS, BatchPacket, GpsPacket


def packet(**overrides) -> GpsPacket:
    data = {
        "device_id": "device-1",
        "user_id": 1,
        "activity_id": 42,
        "lat": 52.1,
        "lon": 21.0,
        "altitude_m": 123.4,
        "speed_ms": 8.2,
        "accuracy_m": 5.0,
        "timestamp": 1_700_000_000.0,
        "seq": 1,
        "idempotency_key": "42:1700000000:1",
        "segment_break": False,
    }
    data.update(overrides)
    return GpsPacket(**data)


def test_packet_rejects_impossible_coordinates():
    with pytest.raises(ValidationError):
        packet(lat=91.0)
    with pytest.raises(ValidationError):
        packet(lon=-181.0)


def test_packet_rejects_unknown_fields_instead_of_silently_ignoring_them():
    with pytest.raises(ValidationError):
        GpsPacket(device_id="d", lat=52.0, lon=21.0, unexpected="value")


def test_batch_requires_non_empty_id_and_packets():
    with pytest.raises(ValidationError):
        BatchPacket(client_batch_id="batch-1", packets=[])
    with pytest.raises(ValidationError):
        BatchPacket(client_batch_id="", packets=[packet()])


def test_batch_rejects_metadata_mismatch_and_mixed_activities():
    with pytest.raises(ValidationError):
        BatchPacket(
            client_batch_id="batch-count",
            packets=[packet()],
            point_count=2,
            activity_id=42,
            max_seq=1,
        )

    with pytest.raises(ValidationError):
        BatchPacket(
            client_batch_id="batch-activity",
            packets=[packet(seq=1), packet(activity_id=43, seq=2)],
            point_count=2,
        )

    with pytest.raises(ValidationError):
        BatchPacket(
            client_batch_id="batch-seq",
            packets=[packet(seq=7)],
            point_count=1,
            activity_id=42,
            max_seq=8,
        )


def test_batch_rejects_missing_point_activity_when_wrapper_is_scoped():
    with pytest.raises(ValidationError):
        BatchPacket(
            client_batch_id="batch-missing-point-activity",
            packets=[packet(seq=1), packet(activity_id=None, seq=2)],
            point_count=2,
            activity_id=42,
            max_seq=2,
        )


def test_batch_rejects_mixed_present_and_missing_packet_activity_without_wrapper():
    with pytest.raises(ValidationError):
        BatchPacket(
            client_batch_id="batch-mixed-activity-presence",
            packets=[packet(seq=1), packet(activity_id=None, seq=2)],
            point_count=2,
            max_seq=2,
        )


def test_batch_accepts_mobile_contract_and_enforces_bound():
    batch = BatchPacket(
        client_batch_id="batch-ok",
        packets=[packet(seq=1), packet(seq=2)],
        point_count=2,
        activity_id=42,
        max_seq=2,
    )
    assert len(batch.packets) == 2

    many = [packet(seq=index + 1) for index in range(MAX_INGEST_BATCH_POINTS + 1)]
    with pytest.raises(ValidationError):
        BatchPacket(client_batch_id="batch-too-large", packets=many)
