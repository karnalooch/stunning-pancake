"""
Shared live-map read path for HTTP GET and SSE stream (admin Live Map).
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import Any


def _live_float(pos: dict, *keys: str, default: float = 0.0) -> float:
    for key in keys:
        raw = pos.get(key)
        if raw is None:
            continue
        try:
            val = float(raw)
        except (TypeError, ValueError):
            continue
        if math.isfinite(val):
            return val
    return default


def _live_coords(pos: dict) -> tuple[float, float] | None:
    lat = _live_float(pos, "latitude", "lat")
    lng = _live_float(pos, "longitude", "lng", "lon")
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
        return None
    if lat == 0.0 and lng == 0.0:
        return None
    return lat, lng


@dataclass(frozen=True)
class LiveMapRequest:
    bbox_tuple: tuple[float, float, float, float] | None
    limit: int
    zoom_param: float | None
    detail: str
    fetch_limit: int | None
    skip_cache: bool


def parse_live_map_query_params(
    query_params,
    *,
    default_skip_cache: bool = False,
) -> LiveMapRequest:
    """Parse bbox, limit, zoom, detail from DRF request.query_params."""
    bbox_tuple = None
    bbox_str = query_params.get("bbox", "")
    if bbox_str:
        try:
            parts = [float(x) for x in bbox_str.split(",")]
            if len(parts) == 4:
                bbox_tuple = tuple(parts)
        except (ValueError, TypeError):
            pass

    try:
        limit = int(query_params.get("limit", 0))
    except (TypeError, ValueError):
        limit = 0

    zoom_param = None
    try:
        z = query_params.get("zoom", "")
        if z != "":
            zoom_param = float(z)
    except (TypeError, ValueError):
        zoom_param = None

    from activities.telemetry_shard import live_map_read_policy

    read_policy = live_map_read_policy()

    detail = (query_params.get("detail") or "").strip().lower()
    if detail not in ("summary", "standard", "full"):
        if zoom_param is not None and zoom_param < 5:
            detail = "summary"
        elif zoom_param is not None and zoom_param < 11.5:
            detail = "standard"
        else:
            detail = "full"

    if read_policy.ingest_engaged and read_policy.detail_ceiling:
        _rank = {"summary": 0, "standard": 1, "full": 2}
        ceiling = read_policy.detail_ceiling
        if _rank.get(detail, 2) > _rank.get(ceiling, 1):
            detail = ceiling

    fetch_limit = limit or None
    if detail == "summary":
        fetch_limit = 0

    skip_cache = default_skip_cache
    refresh = query_params.get("refresh", "").strip()
    if refresh not in ("", "0", "false"):
        skip_cache = True

    return LiveMapRequest(
        bbox_tuple=bbox_tuple,
        limit=limit,
        zoom_param=zoom_param,
        detail=detail,
        fetch_limit=fetch_limit,
        skip_cache=skip_cache,
    )


def stream_interval_ms(
    zoom: float | None,
    ingest_engaged: bool,
    poll_multiplier: float = 1.0,
) -> int:
    """SSE cadence 200–500 ms at street zoom; slower when ingest engaged."""
    z = zoom if zoom is not None else 6.0
    if z >= 14:
        base = 200
    elif z >= 12:
        base = 350
    elif z >= 10:
        base = 450
    else:
        base = 500
    if ingest_engaged:
        base = int(base * max(1.0, poll_multiplier))
    return max(200, min(2000, base))


def poll_after_ms_hint(
    zoom: float | None,
    ingest_engaged: bool,
    poll_multiplier: float = 1.0,
) -> int | None:
    """HTTP poll fallback hint — shorter at zoom >= 12."""
    if zoom is None:
        return None
    z = zoom
    if z >= 14:
        base = 800
    elif z >= 12:
        base = 950
    elif z >= 11:
        base = 1500
    elif z >= 9:
        base = 1900
    elif z >= 7:
        base = 2100
    else:
        base = 2400
    if ingest_engaged:
        base = int(max(900, base * poll_multiplier))
    return base


def build_live_map_payload(req: LiveMapRequest) -> dict[str, Any]:
    """Fetch Redis positions and return {positions, meta} for admin clients."""
    from activities.services import TelemetryService
    from activities.telemetry_shard import live_map_read_policy

    read_policy = live_map_read_policy()

    positions, telemetry_meta = TelemetryService.get_live_positions(
        bbox=req.bbox_tuple,
        limit=req.fetch_limit,
        zoom=req.zoom_param,
        skip_cache=req.skip_cache,
    )

    if not isinstance(positions, list):
        positions = []

    need_devices = any(
        isinstance(p, dict)
        and p.get("deviceId") is not None
        and not (p.get("name") or p.get("category") or p.get("type"))
        for p in positions
    )
    device_info = {}
    if need_devices:
        devices = TelemetryService.get_devices()
        if isinstance(devices, list):
            device_info = {
                d.get("id"): {"name": d.get("name"), "type": d.get("category")}
                for d in devices
                if isinstance(d, dict)
            }

    ride_warming = 0
    ride_on_map = 0
    city_counts: dict[str, int] = {}
    ride_states_by_device: dict[str, str] = {}
    try:
        from activities import simulator_state as sim_state
        from activities.ride_fsm import fsm_summary, normalize_ride_state

        rides_map = sim_state.get_live_rides()
        fsm = fsm_summary(rides_map)
        ride_on_map = fsm["ride_on_map"]
        ride_warming = fsm["ride_warming"]
        city_counts = sim_state.get_live_city_counts()
        ride_states_by_device = {
            str(uid): normalize_ride_state(ride) for uid, ride in rides_map.items()
        }
    except Exception:
        pass

    enriched_data = []
    viewport_bike = 0
    viewport_run = 0
    _bike = frozenset({"bike", "bicycle", "cycling", "cyclist"})
    _run = frozenset({"run", "running", "runner", "person", "walk", "walking", "foot"})
    detail = req.detail

    for pos in positions:
        if not isinstance(pos, dict):
            continue
        device_id = pos.get("deviceId")
        if device_id is None:
            continue
        coords = _live_coords(pos)
        if coords is None:
            continue
        lat, lng = coords
        info = device_info.get(device_id, {})
        type_label = pos.get("category") or pos.get("type") or info.get("type", "person")
        raw_type = (type_label or "").lower()
        if raw_type in _bike:
            viewport_bike += 1
        elif raw_type in _run:
            viewport_run += 1
        ride_state = ride_states_by_device.get(str(device_id))
        speed = _live_float(pos, "speed", default=0.0)
        course = _live_float(pos, "course", default=0.0)
        if detail == "standard":
            row = {
                "deviceId": device_id,
                "type": type_label,
                "lat": lat,
                "lng": lng,
                "speed": speed,
                "course": course,
            }
            if ride_state:
                row["ride_state"] = ride_state
            enriched_data.append(row)
        else:
            row = {
                "deviceId": device_id,
                "name": pos.get("name") or info.get("name", f"Athlete {device_id}"),
                "type": type_label,
                "lat": lat,
                "lng": lng,
                "speed": speed,
                "course": course,
                "lastUpdate": pos.get("deviceTime"),
            }
            if ride_state:
                row["ride_state"] = ride_state
            enriched_data.append(row)

    active_riding = ride_on_map or (
        telemetry_meta.get("active_riding") or telemetry_meta.get("redis_active", 0)
    )

    poll_hint = poll_after_ms_hint(
        req.zoom_param,
        read_policy.ingest_engaged,
        read_policy.poll_interval_multiplier if read_policy.ingest_engaged else 1.0,
    )
    stream_ms = stream_interval_ms(
        req.zoom_param,
        read_policy.ingest_engaged,
        read_policy.poll_interval_multiplier if read_policy.ingest_engaged else 1.0,
    )

    read_mode = "normal"
    if read_policy.ingest_engaged:
        read_mode = "ingest_protected"
    elif telemetry_meta.get("cached"):
        read_mode = "cached"
    elif telemetry_meta.get("capped"):
        read_mode = "viewport_capped"

    if telemetry_meta.get("cached") and not enriched_data:
        telemetry_meta = {**telemetry_meta, "cached": False, "cache_stale_empty": True}

    return {
        "positions": enriched_data,
        "meta": {
            **telemetry_meta,
            "positions_returned": len(enriched_data),
            "detail": detail,
            "redis_active": active_riding,
            "active_riding": active_riding,
            "ride_on_map": ride_on_map,
            "ride_warming": ride_warming,
            "viewport_bike": viewport_bike,
            "viewport_run": viewport_run,
            "city_counts": city_counts,
            "ingest_engaged": read_policy.ingest_engaged,
            "live_read_throttled": read_policy.ingest_engaged,
            "live_poll_interval_multiplier": (
                read_policy.poll_interval_multiplier if read_policy.ingest_engaged else 1.0
            ),
            "live_detail_ceiling": (
                read_policy.detail_ceiling if read_policy.ingest_engaged else None
            ),
            "poll_after_ms": poll_hint,
            "stream_interval_ms": stream_ms,
            "server_time": time.time(),
            "read_mode": read_mode,
            "pool_note": (
                "active = ACTIVE riders on map (FSM); warming = PENDING_ROUTE + ROUTING; "
                "cyclists/runners = current viewport only."
            ),
        },
    }
