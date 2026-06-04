"""Pydantic models for telemetry ingest."""

from __future__ import annotations

import time

from pydantic import BaseModel, Field


class GpsPacket(BaseModel):
    device_id: str
    user_id: int | None = None
    lat: float
    lon: float
    speed_ms: float = 0.0
    accuracy_m: float = 5.0
    activity_id: int | None = None
    timestamp: float = Field(default_factory=time.time)
    seq: int | None = None
    idempotency_key: str | None = None


class BatchPacket(BaseModel):
    packets: list[GpsPacket]
    client_batch_id: str | None = None
