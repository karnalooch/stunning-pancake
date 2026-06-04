"""HTTP and WebSocket routes for the telemetry service."""

from __future__ import annotations

import asyncio
import logging
import time

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from config import BACKFILL_MAX_POINTS, BACKFILL_WINDOW_MIN, WS_INGEST_BUFFER_MAX
from db import get_pool
from ingest_guard import check_ingest_allowed
from ingest_queue import STREAM_KEY, queue_enabled, stream_depth
from ingest_service import (
    filter_privacy_packets,
    get_ingest_redis,
    is_duplicate_batch,
    maybe_broadcast,
    packet_to_row,
    persist_ingest_rows,
)
from privacy import is_in_privacy_zone, zones
from schemas import BatchPacket, GpsPacket
from ws_manager import manager

logger = logging.getLogger("telemetry")

router = APIRouter()


@router.get("/api/telemetry/health")
async def health() -> dict:
    return {"status": "ok", "zones_cached": len(zones)}


@router.post("/api/telemetry/ingest", status_code=202)
async def ingest_packet(packet: GpsPacket) -> dict:
    guard = await check_ingest_allowed(await get_ingest_redis(), 1)
    if is_in_privacy_zone(packet.user_id, packet.lat, packet.lon):
        return {"status": "dropped_privacy"}

    result = await persist_ingest_rows(
        [packet_to_row(packet)],
        client_batch_id=None,
        activity_id=packet.activity_id,
        guard=guard,
    )
    await maybe_broadcast(
        {
            "type": "position_update",
            "device_id": packet.device_id,
            "user_id": packet.user_id,
            "lat": packet.lat,
            "lon": packet.lon,
            "speed_ms": packet.speed_ms,
            "activity_id": packet.activity_id,
        }
    )
    return {
        "status": "accepted",
        "inserted": result["inserted"],
        "queued": result["queued"],
        "ingest_mode": result["ingest_mode"],
        "acked": True,
    }


@router.post("/api/telemetry/ingest/batch", status_code=202)
async def ingest_batch(batch: BatchPacket) -> dict:
    n = len(batch.packets)
    guard = await check_ingest_allowed(await get_ingest_redis(), max(1, n))

    if await is_duplicate_batch(batch.client_batch_id):
        return {
            "status": "accepted",
            "inserted": 0,
            "deduped": True,
            "client_batch_id": batch.client_batch_id,
            "acked": True,
        }

    rows, dropped, activity_id, max_seq = filter_privacy_packets(batch.packets)
    result = {"inserted": 0, "queued": False, "ingest_mode": "direct"}
    if rows:
        result = await persist_ingest_rows(
            rows,
            client_batch_id=batch.client_batch_id,
            activity_id=activity_id,
            guard=guard,
        )
        last = batch.packets[-1]
        await maybe_broadcast(
            {
                "type": "position_update",
                "device_id": last.device_id,
                "user_id": last.user_id,
                "lat": last.lat,
                "lon": last.lon,
                "speed_ms": last.speed_ms,
                "activity_id": last.activity_id,
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
        "point_count": len(rows),
        "max_seq": max_seq,
        "activity_id": activity_id,
        "acked": True,
    }


@router.post("/api/telemetry/ingest/backfill", status_code=202)
async def ingest_backfill(batch: BatchPacket, activity_id: int = Query(...)) -> dict:
    if not activity_id:
        raise HTTPException(status_code=400, detail="activity_id required")

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT end_time, start_time FROM activities_activity WHERE id = $1",
            activity_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="activity not found")
    if row["end_time"] is None:
        raise HTTPException(status_code=409, detail="activity still active — use live ingest")

    end_time = row["end_time"].timestamp()
    if time.time() - end_time > BACKFILL_WINDOW_MIN * 60:
        raise HTTPException(
            status_code=410,
            detail=f"backfill window expired ({BACKFILL_WINDOW_MIN} min)",
        )

    if len(batch.packets) > BACKFILL_MAX_POINTS:
        raise HTTPException(
            status_code=413,
            detail=f"max {BACKFILL_MAX_POINTS} points per backfill request",
        )

    n = len(batch.packets)
    guard = await check_ingest_allowed(await get_ingest_redis(), max(1, n))
    if await is_duplicate_batch(batch.client_batch_id):
        return {
            "status": "accepted",
            "inserted": 0,
            "deduped": True,
            "client_batch_id": batch.client_batch_id,
            "acked": True,
        }

    rows = []
    for p in batch.packets:
        if p.activity_id and p.activity_id != activity_id:
            continue
        if is_in_privacy_zone(p.user_id, p.lat, p.lon):
            continue
        rows.append(packet_to_row(p))

    result = await persist_ingest_rows(
        rows,
        client_batch_id=batch.client_batch_id,
        activity_id=activity_id,
        guard=guard,
    )
    return {
        "status": "accepted",
        "inserted": result["inserted"],
        "queued": result["queued"],
        "ingest_mode": result["ingest_mode"],
        "client_batch_id": batch.client_batch_id,
        "activity_id": activity_id,
        "acked": True,
    }


@router.get("/api/telemetry/ingest/queue/stats")
async def ingest_queue_stats() -> dict:
    if not queue_enabled():
        return {"enabled": False}
    client = await get_ingest_redis()
    depth = await stream_depth(client)
    return {"enabled": True, "stream": STREAM_KEY, "xlen": depth}


@router.websocket("/ws/telemetry/live")
async def websocket_live(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            await asyncio.sleep(30)
            await ws.send_json({"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect(ws)


@router.websocket("/ws/telemetry/ingest")
async def websocket_ingest(ws: WebSocket) -> None:
    await ws.accept()
    logger.info("ws.ingest: mobile client connected")
    pending_buffer: list[dict] = []
    last_acked_seq: int | None = None
    try:
        while True:
            data = await ws.receive_json()
            if isinstance(data, dict) and data.get("type") == "ping":
                await ws.send_json({"type": "pong", "last_acked_seq": last_acked_seq})
                continue
            if isinstance(data, dict) and data.get("type") == "resume":
                last_acked_seq = data.get("last_acked_seq")
                await ws.send_json({"type": "resume_ack", "last_acked_seq": last_acked_seq})
                continue

            packets = data if isinstance(data, list) else [data]
            if not isinstance(packets, list):
                packets = [packets]

            while len(pending_buffer) >= WS_INGEST_BUFFER_MAX:
                pending_buffer.pop(0)

            for raw in packets:
                if isinstance(raw, dict):
                    pending_buffer.append(raw)

            n = len(packets) if isinstance(packets, list) else 1
            guard = await check_ingest_allowed(await get_ingest_redis(), max(1, n))

            rows = []
            activity_id: int | None = None
            max_seq: int | None = None
            for p in pending_buffer[-n:]:
                try:
                    pkt = GpsPacket.model_validate(p)
                    if is_in_privacy_zone(pkt.user_id, pkt.lat, pkt.lon):
                        continue
                    rows.append(packet_to_row(pkt))
                    activity_id = pkt.activity_id or activity_id
                    if pkt.seq is not None:
                        max_seq = pkt.seq if max_seq is None else max(max_seq, pkt.seq)
                except Exception:
                    continue

            if not rows:
                continue

            try:
                result = await persist_ingest_rows(
                    rows,
                    client_batch_id=None,
                    activity_id=activity_id,
                    guard=guard,
                )
            except HTTPException as exc:
                await ws.send_json(
                    {
                        "type": "error",
                        "status": exc.status_code,
                        "detail": exc.detail,
                        "retry_after": exc.headers.get("Retry-After", "1") if exc.headers else "1",
                    }
                )
                if exc.status_code == 429:
                    await ws.close(code=1013, reason="ingest throttled")
                elif exc.status_code == 503:
                    await ws.close(code=1013, reason="system overload")
                break

            if max_seq is not None:
                last_acked_seq = max_seq
            last = rows[-1]
            await ws.send_json(
                {
                    "type": "ack",
                    "inserted": result["inserted"],
                    "queued": result["queued"],
                    "last_acked_seq": last_acked_seq,
                }
            )
            await maybe_broadcast(
                {
                    "type": "position_update",
                    "device_id": last[1],
                    "user_id": last[2],
                    "lat": last[3],
                    "lon": last[4],
                    "speed_ms": last[5],
                    "source": "ws_ingest",
                }
            )
    except WebSocketDisconnect:
        logger.info("ws.ingest: mobile client disconnected")
    except Exception as exc:
        logger.error("ws.ingest: unexpected error: %s", exc)


@router.get("/api/telemetry/live")
async def get_live_positions(device_id: str | None = None, limit: int = 50) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        if device_id:
            rows = await conn.fetch(
                "SELECT * FROM gps_points WHERE device_id = $1 ORDER BY time DESC LIMIT $2",
                device_id,
                limit,
            )
        else:
            rows = await conn.fetch(
                "SELECT DISTINCT ON (device_id) * FROM gps_points "
                "ORDER BY device_id, time DESC LIMIT $1",
                limit,
            )
    return [dict(r) for r in rows]


@router.get("/api/telemetry/history/{device_id}")
async def get_device_history(
    device_id: str, since_unix: float, until_unix: float | None = None
) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        if until_unix:
            rows = await conn.fetch(
                "SELECT * FROM gps_points WHERE device_id = $1 "
                "AND time BETWEEN to_timestamp($2) AND to_timestamp($3) ORDER BY time ASC",
                device_id,
                since_unix,
                until_unix,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM gps_points WHERE device_id = $1 "
                "AND time >= to_timestamp($2) ORDER BY time ASC",
                device_id,
                since_unix,
            )
    return [dict(r) for r in rows]
