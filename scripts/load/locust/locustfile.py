"""
Locust harness for telemetry ingest and optional live-map reads.

  locust -f scripts/load/locust/locustfile.py --host http://localhost:8001
  INGEST_BATCH_SIZE=50 MAP_URL=http://localhost:8000/api/activities/telemetry/live/ \
    JWT=eyJ... locust -f scripts/load/locust/locustfile.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

_LOCUST_DIR = Path(__file__).resolve().parent
_LOAD_ROOT = _LOCUST_DIR.parent
if str(_LOAD_ROOT) not in sys.path:
    sys.path.insert(0, str(_LOAD_ROOT))

from locust import HttpUser, between, task  # noqa: E402

from lib.packets import make_batch_body  # noqa: E402

INGEST_PATH = os.environ.get("INGEST_PATH", "/api/telemetry/ingest/batch")
BATCH_SIZE = int(os.environ.get("INGEST_BATCH_SIZE", "50"))
MAP_URL = os.environ.get("MAP_URL", "")
JWT = os.environ.get("JWT", "")
MAP_WEIGHT = int(os.environ.get("MAP_TASK_WEIGHT", "0"))


class TelemetryUser(HttpUser):
    wait_time = between(0.01, 0.05)

    def on_start(self) -> None:
        self._map_headers = {"Authorization": f"Bearer {JWT}"} if JWT else {}

    @task(10)
    def ingest_batch(self) -> None:
        body = make_batch_body(BATCH_SIZE, device_prefix="locust")
        with self.client.post(
            INGEST_PATH,
            json=body,
            name="ingest-batch",
            catch_response=True,
        ) as response:
            if response.status_code in (202, 429):
                response.success()
            else:
                response.failure(f"unexpected status {response.status_code}")

    @task(MAP_WEIGHT)
    def live_map_read(self) -> None:
        if not MAP_URL:
            return
        params = {"zoom": 6, "limit": 800, "detail": "summary"}
        with self.client.get(
            MAP_URL,
            params=params,
            headers=self._map_headers,
            name="live-map",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"map status {response.status_code}")
