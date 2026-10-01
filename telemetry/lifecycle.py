"""App startup / shutdown (schema readiness, privacy zones, background tasks)."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from bridges import traccar_redis_bridge
from config import SKIP_BROADCAST, SKIP_DB
from db import close_pool, flush_insert_buffer, get_pool
from ingest_queue import queue_enabled, start_drain_worker, stop_drain_worker
from ingest_service import get_ingest_redis
from privacy import load_zones_from_rows, privacy_zones_sync, zones
from production_security import assert_production_security
from schema import assert_schema_ready

logger = logging.getLogger("telemetry")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    assert_production_security()
    pool = await get_pool()
    async with pool.acquire() as conn:
        await assert_schema_ready(conn)

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

    yield

    await stop_drain_worker()
    await close_pool()
