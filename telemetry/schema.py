"""Telemetry schema bootstrap and runtime readiness contract."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("telemetry")

SCHEMA_DDL = (
    """
    CREATE TABLE IF NOT EXISTS gps_points (
        time        TIMESTAMPTZ      NOT NULL,
        device_id   TEXT             NOT NULL,
        user_id     INTEGER,
        lat         DOUBLE PRECISION NOT NULL,
        lon         DOUBLE PRECISION NOT NULL,
        speed_ms    DOUBLE PRECISION DEFAULT 0,
        accuracy_m  DOUBLE PRECISION DEFAULT 5,
        activity_id INTEGER,
        seq         BIGINT
    );
    """,
    "ALTER TABLE gps_points ADD COLUMN IF NOT EXISTS seq BIGINT;",
    """
    CREATE UNIQUE INDEX IF NOT EXISTS gps_points_activity_time_seq_uidx
    ON gps_points (activity_id, time, seq)
    WHERE activity_id IS NOT NULL AND seq IS NOT NULL;
    """,
    """
    CREATE TABLE IF NOT EXISTS telemetry_ingest_receipts (
        client_batch_id TEXT PRIMARY KEY,
        activity_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        point_count INTEGER NOT NULL CHECK (point_count > 0),
        persisted_count INTEGER NOT NULL CHECK (persisted_count >= 0),
        dropped_privacy INTEGER NOT NULL CHECK (dropped_privacy >= 0),
        max_seq BIGINT NOT NULL CHECK (max_seq > 0),
        payload_fingerprint TEXT NOT NULL,
        acked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (persisted_count + dropped_privacy = point_count)
    );
    """,
    """
    ALTER TABLE telemetry_ingest_receipts
    ADD COLUMN IF NOT EXISTS payload_fingerprint TEXT;
    """,
    """
    CREATE INDEX IF NOT EXISTS telemetry_ingest_receipts_activity_user_idx
    ON telemetry_ingest_receipts (activity_id, user_id, max_seq);
    """,
)

REQUIRED_INDEXES = frozenset(
    {
        "gps_points_activity_time_seq_uidx",
        "telemetry_ingest_receipts_activity_user_idx",
    },
)

_READINESS_QUERIES = (
    """
    SELECT time, device_id, user_id, lat, lon, speed_ms, accuracy_m, activity_id, seq
    FROM gps_points
    LIMIT 0;
    """,
    """
    SELECT client_batch_id, activity_id, user_id, point_count, persisted_count,
           dropped_privacy, max_seq, payload_fingerprint, acked_at
    FROM telemetry_ingest_receipts
    LIMIT 0;
    """,
)


async def bootstrap_schema(conn: Any) -> None:
    """Idempotently create/evolve telemetry-owned schema with migration credentials."""
    for statement in SCHEMA_DDL:
        await conn.execute(statement)

    try:
        await conn.execute("SELECT create_hypertable('gps_points', 'time', if_not_exists => TRUE);")
    except Exception as exc:
        # Preserve the existing optional Timescale behavior: plain PostgreSQL
        # remains supported, while a configured Timescale instance is upgraded
        # to a hypertable when the function is available.
        logger.info("telemetry schema: hypertable bootstrap skipped: %s", exc)


async def assert_schema_ready(conn: Any) -> None:
    """Fail closed when the runtime schema is missing or incompatible."""
    try:
        for query in _READINESS_QUERIES:
            await conn.fetch(query)
        rows = await conn.fetch(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = ANY($1::text[]);
            """,
            sorted(REQUIRED_INDEXES),
        )
    except Exception as exc:
        raise RuntimeError(
            "telemetry schema is not ready; run 'python schema_bootstrap.py' "
            "with migration-owner credentials before starting telemetry workers"
        ) from exc

    present = {str(row["indexname"]) for row in rows}
    missing = sorted(REQUIRED_INDEXES - present)
    if missing:
        raise RuntimeError(
            "telemetry schema is not ready; missing indexes: "
            + ", ".join(missing)
            + "; run 'python schema_bootstrap.py' with migration-owner credentials"
        )
