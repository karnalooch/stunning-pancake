"""Pydantic models for telemetry ingest."""

from __future__ import annotations

import time

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_INGEST_BATCH_POINTS = 500


class GpsPacket(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_id: str = Field(min_length=1, max_length=128)
    user_id: int | None = Field(default=None, ge=1)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    altitude_m: float | None = None
    speed_ms: float = Field(default=0.0, ge=0, le=100)
    accuracy_m: float = Field(default=5.0, ge=0, le=10_000)
    activity_id: int | None = Field(default=None, ge=1)
    timestamp: float = Field(default_factory=time.time, gt=0)
    seq: int | None = Field(default=None, ge=0)
    idempotency_key: str | None = Field(default=None, min_length=1, max_length=200)
    segment_break: bool | None = None


class BatchPacket(BaseModel):
    model_config = ConfigDict(extra="forbid")

    packets: list[GpsPacket] = Field(min_length=1, max_length=MAX_INGEST_BATCH_POINTS)
    client_batch_id: str = Field(min_length=1, max_length=128)
    point_count: int | None = Field(default=None, ge=1, le=MAX_INGEST_BATCH_POINTS)
    max_seq: int | None = Field(default=None, ge=0)
    activity_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_batch_contract(self) -> BatchPacket:
        if self.point_count is not None and self.point_count != len(self.packets):
            raise ValueError("point_count must equal len(packets)")

        packet_activity_values = [packet.activity_id for packet in self.packets]
        packet_activity_ids = {value for value in packet_activity_values if value is not None}
        if len(packet_activity_ids) > 1:
            raise ValueError("all packets in a batch must belong to one activity")
        if self.activity_id is not None:
            if any(value != self.activity_id for value in packet_activity_values):
                raise ValueError("activity_id must match every packet activity_id")
        elif packet_activity_ids and any(value is None for value in packet_activity_values):
            raise ValueError("packet activity_id must be consistently present or absent")

        packet_seqs = [packet.seq for packet in self.packets if packet.seq is not None]
        if self.max_seq is not None and packet_seqs and self.max_seq != max(packet_seqs):
            raise ValueError("max_seq must match the highest packet seq")
        return self
