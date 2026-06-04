"""App startup / shutdown (schema, privacy zones, background tasks)."""

from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI

from bridges import traccar_redis_bridge
from config import SKIP_BROADCAST, SKIP_DB
from db import close_pool, flush_insert_buffer, get_pool
from ingest_queue import queue_enabled, start_drain_worker, stop_drain_worker
from ingest_service import get_ingest_redis
from privacy import load_zones_from_rows, privacy_zones_sync, zones

logger = logging.getLogger("telemetry")


def register_lifecycle(app: FastAPI) -> None:
    @app.on_event("startup")
    async def startup() -> None:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS gps_points (
                    time        TIMESTAMPTZ     NOT NULL,
                    device_id   TEXT            NOT NULL,
                    user_id     INTEGER,
                    lat         DOUBLE PRECISION NOT NULL,
                    lon         DOUBLE PRECISION NOT NULL,
                    speed_ms    DOUBLE PRECISION DEFAULT 0,
                    accuracy_m  DOUBLE PRECISION DEFAULT 5,
                    activity_id INTEGER,
                    seq         BIGINT
                );
            """)
            await conn.execute("ALTER TABLE gps_points ADD COLUMN IF NOT EXISTS seq BIGINT;")
            await conn.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS gps_points_activity_time_seq_uidx
                ON gps_points (activity_id, time, seq)
                WHERE activity_id IS NOT NULL AND seq IS NOT NULL;
            """)
            try:
                await conn.execute(
                    "SELECT create_hypertable('gps_points', 'time', if_not_exists => TRUE);"
                )
            except Exception:
                pass

        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT user_id, ST_Y(center::geometry) as lat, "
                    "ST_X(center::geometry) as lon, radius, id FROM activities_privacyzone"
                )
            load_zones_from_rows(rows)
            logger.info(
                "privacy_zones: loaded %d zones for %d users",
                len(rows),
                len(zones),
            )
        except Exception as exc:
            logger.warning("privacy_zones: initial load skipped (table missing or empty): %s", exc)

        asyncio.create_task(traccar_redis_bridge())
        asyncio.create_task(privacy_zones_sync())
        if queue_enabled() and not SKIP_DB:
            start_drain_worker(await get_ingest_redis(), flush_insert_buffer)
        if SKIP_DB:
            logger.info("TELEMETRY_SKIP_DB=1: ingest guard+dedupe only, DB insert disabled")
        if SKIP_BROADCAST or SKIP_DB:
            logger.info(
                "WebSocket broadcast disabled (TELEMETRY_SKIP_BROADCAST=%s, TELEMETRY_SKIP_DB=%s)",
                SKIP_BROADCAST,
                SKIP_DB,
            )
        logger.info("telemetry engine fully operational")

    @app.on_event("shutdown")
    async def shutdown() -> None:
        await stop_drain_worker()
        await close_pool()
