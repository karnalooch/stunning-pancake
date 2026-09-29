"""Real PostgreSQL + Redis proof for durable telemetry ingest (T20)."""

from __future__ import annotations

import os
import time
import uuid

import httpx
import jwt
import pytest
import pytest_asyncio
from fastapi import FastAPI

import ingest_service
from db import close_pool, get_pool
from durable_routes import router as durable_router
from ingest_auth import IngestJwtMiddleware
from ingest_service import get_ingest_redis
from privacy import zones
from schema import assert_schema_ready, bootstrap_schema

JWT_SECRET = os.environ.get("TELEMETRY_INGEST_JWT_SECRET") or os.environ["SECRET_KEY"]
USER_ID = 930_001
ACTIVITY_IDS = (920_001, 920_002, 920_003, 920_004)
_CREATED_BATCH_IDS: set[str] = set()

app = FastAPI()
app.add_middleware(IngestJwtMiddleware)
app.include_router(durable_router)


def _batch_id(label: str) -> str:
    value = f"t20-{label}-{uuid.uuid4().hex}"
    _CREATED_BATCH_IDS.add(value)
    return value


def _token(*, activity_id: int, user_id: int = USER_ID) -> str:
    return jwt.encode(
        {
            "sub": str(user_id),
            "activity_id": activity_id,
            "aud": "telemetry",
            "exp": int(time.time()) + 300,
        },
        JWT_SECRET,
        algorithm="HS256",
    )


def _payload(
    *,
    activity_id: int,
    batch_id: str,
    coordinates: list[tuple[float, float]],
    user_id: int = USER_ID,
) -> dict:
    packets = []
    for seq, (lat, lon) in enumerate(coordinates, start=1):
        packets.append(
            {
                "device_id": f"t20-device-{activity_id}",
                "user_id": user_id,
                "activity_id": activity_id,
                "lat": lat,
                "lon": lon,
                "speed_ms": 7.5,
                "accuracy_m": 3.0,
                "timestamp": 1_800_000_000.0 + activity_id + seq / 10,
                "seq": seq,
            }
        )
    return {
        "client_batch_id": batch_id,
        "point_count": len(packets),
        "max_seq": len(packets),
        "activity_id": activity_id,
        "packets": packets,
    }


async def _post(
    payload: dict,
    *,
    token_activity_id: int,
    token_user_id: int = USER_ID,
) -> httpx.Response:
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    headers = {
        "Authorization": f"Bearer {_token(activity_id=token_activity_id, user_id=token_user_id)}"
    }
    async with httpx.AsyncClient(transport=transport, base_url="http://t20.test") as client:
        return await client.post(
            "/api/telemetry/ingest/batch",
            json=payload,
            headers=headers,
        )


async def _cleanup() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM gps_points WHERE activity_id = ANY($1::integer[])",
            list(ACTIVITY_IDS),
        )
        await conn.execute(
            "DELETE FROM telemetry_ingest_receipts WHERE activity_id = ANY($1::integer[])",
            list(ACTIVITY_IDS),
        )

    redis_client = await get_ingest_redis()
    if _CREATED_BATCH_IDS:
        await redis_client.delete(
            *[f"telemetry:dedupe:{batch_id}" for batch_id in sorted(_CREATED_BATCH_IDS)]
        )


@pytest_asyncio.fixture(scope="module", autouse=True)
async def real_dependencies():
    assert os.environ.get("TELEMETRY_INGEST_JWT_REQUIRED") == "1"
    assert os.environ.get("TELEMETRY_INGEST_AUDIENCE_REQUIRED") == "1"
    assert os.environ.get("GLOBAL_PROTECTION_MODE") == "off"
    assert os.environ.get("TELEMETRY_INGEST_QUEUE") == "0"

    pool = await get_pool()
    async with pool.acquire() as conn:
        await bootstrap_schema(conn)
        await assert_schema_ready(conn)

    redis_client = await get_ingest_redis()
    assert await redis_client.ping() is True

    await _cleanup()
    try:
        yield
    finally:
        await _cleanup()
        zones.clear()
        if ingest_service._ingest_redis is not None:
            await ingest_service._ingest_redis.aclose()
            ingest_service._ingest_redis = None
        await close_pool()


@pytest.mark.asyncio
async def test_authenticated_direct_ingest_persists_receipt_and_is_idempotent():
    activity_id = ACTIVITY_IDS[0]
    batch_id = _batch_id("direct")
    payload = _payload(
        activity_id=activity_id,
        batch_id=batch_id,
        coordinates=[(52.1670, 22.2900), (52.1672, 22.2902)],
    )

    first = await _post(payload, token_activity_id=activity_id)
    assert first.status_code == 202, first.text
    first_body = first.json()
    assert first_body == {
        "status": "accepted",
        "inserted": 2,
        "queued": False,
        "ingest_mode": "direct",
        "dropped_privacy": 0,
        "client_batch_id": batch_id,
        "point_count": 2,
        "max_seq": 2,
        "activity_id": activity_id,
        "acked": True,
    }

    pool = await get_pool()
    async with pool.acquire() as conn:
        receipt = await conn.fetchrow(
            """
            SELECT point_count, persisted_count, dropped_privacy, max_seq, user_id
            FROM telemetry_ingest_receipts
            WHERE client_batch_id = $1
            """,
            batch_id,
        )
        rows = await conn.fetch(
            """
            SELECT seq, user_id, lat, lon
            FROM gps_points
            WHERE activity_id = $1
            ORDER BY seq
            """,
            activity_id,
        )

    assert dict(receipt) == {
        "point_count": 2,
        "persisted_count": 2,
        "dropped_privacy": 0,
        "max_seq": 2,
        "user_id": USER_ID,
    }
    assert [row["seq"] for row in rows] == [1, 2]

    redis_client = await get_ingest_redis()
    assert await redis_client.get(f"telemetry:dedupe:{batch_id}") == "acked"

    retry = await _post(payload, token_activity_id=activity_id)
    assert retry.status_code == 202, retry.text
    retry_body = retry.json()
    assert retry_body["deduped"] is True
    assert retry_body["inserted"] == 2
    assert retry_body["point_count"] == 2
    assert retry_body["max_seq"] == 2

    async with pool.acquire() as conn:
        point_count = await conn.fetchval(
            "SELECT COUNT(*) FROM gps_points WHERE activity_id = $1",
            activity_id,
        )
        receipt_count = await conn.fetchval(
            "SELECT COUNT(*) FROM telemetry_ingest_receipts WHERE client_batch_id = $1",
            batch_id,
        )
    assert point_count == 2
    assert receipt_count == 1


@pytest.mark.asyncio
async def test_ingest_scope_rejects_cross_activity_token_without_ack():
    activity_id = ACTIVITY_IDS[1]
    batch_id = _batch_id("scope")
    payload = _payload(
        activity_id=activity_id,
        batch_id=batch_id,
        coordinates=[(52.1680, 22.2910)],
    )

    response = await _post(payload, token_activity_id=activity_id + 100)
    assert response.status_code == 403
    assert response.json()["detail"] == "Telemetry token activity mismatch"

    pool = await get_pool()
    async with pool.acquire() as conn:
        receipt_count = await conn.fetchval(
            "SELECT COUNT(*) FROM telemetry_ingest_receipts WHERE client_batch_id = $1",
            batch_id,
        )
        point_count = await conn.fetchval(
            "SELECT COUNT(*) FROM gps_points WHERE activity_id = $1",
            activity_id,
        )
    assert receipt_count == 0
    assert point_count == 0

    redis_client = await get_ingest_redis()
    assert await redis_client.get(f"telemetry:dedupe:{batch_id}") is None


@pytest.mark.asyncio
async def test_privacy_drop_is_part_of_durable_receipt():
    activity_id = ACTIVITY_IDS[2]
    batch_id = _batch_id("privacy")
    zones[USER_ID] = [
        {
            "lat": 52.1690,
            "lon": 22.2920,
            "radius": 50.0,
            "id": "t20-zone",
        }
    ]
    payload = _payload(
        activity_id=activity_id,
        batch_id=batch_id,
        coordinates=[(52.1690, 22.2920), (52.1800, 22.3100)],
    )

    try:
        response = await _post(payload, token_activity_id=activity_id)
    finally:
        zones.pop(USER_ID, None)

    assert response.status_code == 202, response.text
    body = response.json()
    assert body["inserted"] == 1
    assert body["dropped_privacy"] == 1
    assert body["point_count"] == 2
    assert body["acked"] is True

    pool = await get_pool()
    async with pool.acquire() as conn:
        receipt = await conn.fetchrow(
            """
            SELECT point_count, persisted_count, dropped_privacy, max_seq
            FROM telemetry_ingest_receipts
            WHERE client_batch_id = $1
            """,
            batch_id,
        )
        point_count = await conn.fetchval(
            "SELECT COUNT(*) FROM gps_points WHERE activity_id = $1",
            activity_id,
        )
    assert dict(receipt) == {
        "point_count": 2,
        "persisted_count": 1,
        "dropped_privacy": 1,
        "max_seq": 2,
    }
    assert point_count == 1


@pytest.mark.asyncio
async def test_missing_receipt_storage_fails_closed_without_false_ack():
    activity_id = ACTIVITY_IDS[3]
    batch_id = _batch_id("db-failure")
    payload = _payload(
        activity_id=activity_id,
        batch_id=batch_id,
        coordinates=[(52.1700, 22.2930)],
    )

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DROP TABLE telemetry_ingest_receipts")

    try:
        response = await _post(payload, token_activity_id=activity_id)
        assert response.status_code == 500

        async with pool.acquire() as conn:
            point_count = await conn.fetchval(
                "SELECT COUNT(*) FROM gps_points WHERE activity_id = $1",
                activity_id,
            )
        assert point_count == 0

        redis_client = await get_ingest_redis()
        assert await redis_client.get(f"telemetry:dedupe:{batch_id}") is None
    finally:
        async with pool.acquire() as conn:
            await bootstrap_schema(conn)
            await assert_schema_ready(conn)
