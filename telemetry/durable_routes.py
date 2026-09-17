"""P3 durable telemetry batch endpoint used by the pilot.

This route shadows the legacy batch handler when registered first. It keeps the
existing request/response contract while adding a PostgreSQL receipt for every
ACKed activity-bound client batch, including batches containing only
privacy-dropped points.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from db import ReceiptCollisionError
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


def _activity_batch_identity(
    batch: BatchPacket,
    scoped_activity_id: int | None,
) -> dict[str, int] | None:
    """Return immutable receipt identity for an activity-bound batch.

    Legacy telemetry that is not attached to an activity keeps the historical
    ingest behavior. A ride batch, however, must carry enough metadata to prove
    durable sequence coverage later; acknowledging it without user/sequence
    metadata would make finalization unverifiable after the mobile outbox is
    cleared.
    """

    if scoped_activity_id is None:
        return None

    user_ids = {packet.user_id for packet in batch.packets}
    if None in user_ids or len(user_ids) != 1:
        raise HTTPException(
            status_code=422,
            detail="Activity telemetry requires one user_id for every packet",
        )

    seqs = [packet.seq for packet in batch.packets]
    if any(seq is None or seq <= 0 for seq in seqs):
        raise HTTPException(
            status_code=422,
            detail="Activity telemetry requires a positive seq for every packet",
        )
    concrete_seqs = [int(seq) for seq in seqs if seq is not None]
    if len(set(concrete_seqs)) != len(concrete_seqs):
        raise HTTPException(
            status_code=422,
            detail="Activity telemetry sequence values must be unique within a batch",
        )

    return {
        "activity_id": int(scoped_activity_id),
        "user_id": int(next(iter(user_ids))),
        "point_count": len(batch.packets),
        "max_seq": max(concrete_seqs),
    }


def _durable_receipt_matches(existing: dict, identity: dict[str, int]) -> bool:
    return all(int(existing.get(key, -1)) == value for key, value in identity.items())


def _collision() -> HTTPException:
    return HTTPException(
        status_code=409,
        detail="client_batch_id collision; local batch must be retained",
    )


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

    identity = _activity_batch_identity(batch, scoped_activity_id)
    existing = await get_batch_receipt(batch.client_batch_id)
    if existing is not None:
        if existing.get("legacy_acked"):
            if identity is None:
                return {
                    "status": "accepted",
                    "inserted": 0,
                    "deduped": True,
                    "client_batch_id": batch.client_batch_id,
                    "acked": True,
                }
            # Activity-bound batches need a PostgreSQL receipt. A historical
            # Redis ACK alone is not enough proof, so safely re-run persistence;
            # gps_points has an activity/time/seq conflict guard.
        else:
            if identity is None or not _durable_receipt_matches(existing, identity):
                raise _collision()
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

    receipt = None
    if identity is not None:
        if activity_id != identity["activity_id"] or max_seq != identity["max_seq"]:
            raise _collision()
        receipt = {
            **identity,
            "dropped_privacy": dropped,
        }

    try:
        result = await persist_ingest_rows(
            rows,
            client_batch_id=batch.client_batch_id,
            activity_id=activity_id,
            guard=guard,
            receipt=receipt,
        )
    except ReceiptCollisionError as exc:
        raise _collision() from exc

    if len(rows) > 0:
        last_public_seq = rows[-1][8]
        last_public = next(
            (p for p in reversed(batch.packets) if p.seq == last_public_seq),
            None,
        )
        if last_public is not None:
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
