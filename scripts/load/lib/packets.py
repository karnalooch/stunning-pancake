"""Shared telemetry batch body builder for Locust and other HTTP harnesses."""

from __future__ import annotations

import time
import uuid


def make_batch_body(batch_size: int, device_prefix: str = "load") -> dict:
    """Build a FastAPI /ingest/batch JSON body with *batch_size* packets."""
    base_lat, base_lon = 52.0, 21.0
    now = time.time()
    device_idx = uuid.uuid4().hex[:8]
    packets = []
    for i in range(batch_size):
        packets.append(
            {
                "device_id": f"{device_prefix}-{device_idx}-{i}",
                "lat": base_lat + (i * 0.0001),
                "lon": base_lon + (i * 0.0001),
                "speed_ms": 5.0,
                "timestamp": now,
            }
        )
    return {
        "packets": packets,
        "client_batch_id": str(uuid.uuid4()),
    }
