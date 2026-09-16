"""P3 durable telemetry batch endpoint used by the pilot.

This route shadows the legacy batch handler when registered first. It keeps the
existing request/response contract while adding a PostgreSQL receipt for every
ACKed client batch, including batches containing only privacy-dropped points.
"""

from __future__ import annotations

from fastapi import APIRouter

from ingest_auth import enforce_current_ingest_scope
from ingest_guard import check_ingest_allowed
from ingest_service import (
    filter_privacy_packets,
    get_batch_receipt,
    get_ingest_redis,
    maybe_broadcast,
    persist_ingest_rows,
)
from schemas import BatchPacket

router = APIRouter()


@router.post("/api/telemetry/ingest/batch", status_code=202)
async def ingest_batch_durable(batch: BatchPacket) -> dict:
    packet_activity_ids = {
        packet.activity_id for packet in batch.packets if packet.activity_id is not None
    }
    scoped_activity_id = batch.activity_id
    if scoped_activity_id is None and len(packet_activity_ids) == 1:
        scoped_activity_id = next(iter(packet_activity_ids))
    enforce_current_ingest_scope(
        activity_id=scoped_activity_id,
        user_ids=[packet.user_id for packet in batch.packets],
    )

    existing = await get_batch_receipt(batch.client_batch_id)
    if existing is not None:
        if existing.get("legacy_acked"):
            return {
                "status": "accepted",
                "inserted": 0,
                "deduped": True,
                "client_batch_id": batch.client_batch_id,
                "acked": True,
            }
        return {
            "status": "accepted",
            "inserted": int(existing["persisted_count"]),
            "dropped_privacy": int(existing["dropped_privacy"]),
            "deduped": True,
            "client_batch_id": batch.client_batch_id,
            "point_count": int(existing["point_count"]),
            "max_seq": int(existing["max_seq"]),
            "activity_id": int(existing["activity_id"]),
            "acked": True,
        }

    n = len(batch.packets)
    guard = await check_ingest_allowed(await get_ingest_redis(), max(1, n))
    rows, dropped, activity_id, max_seq = filter_privacy_packets(batch.packets)
    result = await persist_ingest_rows(
        rows,
        client_batch_id=batch.client_batch_id,
        activity_id=activity_id,
        guard=guard,
    )

    if len(rows) > 0:
        last_public = next(
            p
            for p in reversed(batch.packets)
            if not all(
                row[0] != p.timestamp or row[1] != p.device_id
                for row in rows
            )
        )
        await maybe_broadcast(
            {
                "type": "position_update",
                "device_id": last_public.device_id,
                "user_id": last_public.user_id,
                "lat": last_public.lat,
                "lon": last_public.lon,
                "speed_ms": last_public.speed_ms,
                "activity_id": last_public.activity_id,
                "batch_size": len(rows),
            }
        )

    return {
        "status": "accepted",
        "inserted": result["inserted"],
        "queued": result["queued"],
        "ingest_mode": result["ingest_mode"],
        "dropped_privacy": dropped,
        "client_batch_id": batch.client_batch_id,
        "point_count": len(batch.packets),
        "max_seq": max_seq,
        "activity_id": activity_id,
        "acked": True,
    }
