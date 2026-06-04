"""Telemetry service configuration (env-backed)."""

from __future__ import annotations

import os

DB_DSN = os.environ["DATABASE_URL"]
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
TRACCAR_CHANNEL = os.getenv("TRACCAR_REDIS_CHANNEL", "traccar:positions")
ZONE_UPDATE_CHANNEL = "privacy_zones:updates"

SKIP_DB = os.getenv("TELEMETRY_SKIP_DB", "").strip().lower() in ("1", "true", "yes")
SKIP_BROADCAST = os.getenv("TELEMETRY_SKIP_BROADCAST", "").strip().lower() in (
    "1",
    "true",
    "yes",
)


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


DB_POOL_MIN = max(1, _int("TELEMETRY_DB_POOL_MIN", 5))
DB_POOL_MAX = max(DB_POOL_MIN, _int("TELEMETRY_DB_POOL_MAX", 30))
INGEST_BATCH_SIZE = max(1, _int("TELEMETRY_INGEST_BATCH_SIZE", 100))
INGEST_FLUSH_MS = max(10, _int("TELEMETRY_INGEST_FLUSH_MS", 50))

INSERT_SQL = (
    "INSERT INTO gps_points (time, device_id, user_id, lat, lon, speed_ms, accuracy_m, activity_id, seq) "
    "VALUES (to_timestamp($1), $2, $3, $4, $5, $6, $7, $8, $9) "
    "ON CONFLICT (activity_id, time, seq) WHERE activity_id IS NOT NULL AND seq IS NOT NULL "
    "DO NOTHING"
)

DEDUPE_TTL_S = _int("TELEMETRY_DEDUPE_TTL_S", 7 * 24 * 3600)
BACKFILL_WINDOW_MIN = _int("TELEMETRY_BACKFILL_WINDOW_MIN", 30)
BACKFILL_MAX_POINTS = _int("TELEMETRY_BACKFILL_MAX_POINTS", 5000)
WS_INGEST_BUFFER_MAX = max(50, _int("TELEMETRY_WS_BUFFER_MAX", 500))
