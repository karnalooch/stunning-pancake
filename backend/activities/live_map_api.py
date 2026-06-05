"""
Shared live-map read path for HTTP GET and SSE stream (admin Live Map).
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import Any

# Align with admin liveMapEnterprise.ts micro tier (full detail from z≥12).
LIVE_MAP_FULL_DETAIL_MIN_ZOOM = 12.0


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
    activity_type: str | None
    city_slug: str | None
    tenant_id: str | None = None
    department_id: int | None = None
    department_ids: frozenset[int] | None = None


def _normalize_activity_filter(raw: str | None) -> str | None:
    if not raw:
        return None
    val = raw.strip().lower()
    if val in ("", "all", "any"):
        return None
    if val in ("bike", "bicycle", "cycling", "cyclist"):
        return "bike"
    if val in ("run", "running", "runner", "walk", "walking"):
        return "run"
    return None


def _position_activity_kind(type_label: str | None) -> str:
    raw = (type_label or "").lower()
    if raw in ("bike", "bicycle", "cycling", "cyclist"):
        return "bike"
    if raw in ("run", "running", "runner", "person", "walk", "walking", "foot"):
        return "run"
    return "bike"


def _pos_scope_fields(pos: dict) -> tuple[str | None, int | None]:
    raw_tenant = pos.get("tenantId") or pos.get("tenant_id")
    tenant = str(raw_tenant).strip() if raw_tenant else None
    raw_dept = pos.get("departmentId") or pos.get("department_id")
    dept = None
    if raw_dept is not None and raw_dept != "":
        try:
            dept = int(raw_dept)
        except (TypeError, ValueError):
            dept = None
    return tenant or None, dept


def parse_live_map_query_params(
    query_params,
    *,
    user=None,
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
        elif zoom_param is not None and zoom_param < LIVE_MAP_FULL_DETAIL_MIN_ZOOM:
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

    activity_type = _normalize_activity_filter(query_params.get("activity_type") or query_params.get("type"))
    city_slug = (query_params.get("city") or query_params.get("city_slug") or "").strip().lower() or None

    tenant_id = None
    department_id = None
    department_ids = None
    if user is not None:
        from activities.live_map_rbac import resolve_live_map_scope

        scope = resolve_live_map_scope(user, query_params)
        tenant_id = scope.tenant_id
        department_id = scope.department_id
        if getattr(user, "has_role", None) and user.has_role("department_moderator"):
            moderated = list(
                user.moderated_departments.filter(is_active=True).values_list("id", flat=True)
            )
            if moderated:
                department_ids = frozenset(moderated)
                if department_id is not None and department_id not in department_ids:
                    department_id = None

    return LiveMapRequest(
        bbox_tuple=bbox_tuple,
        limit=limit,
        zoom_param=zoom_param,
        detail=detail,
        fetch_limit=fetch_limit,
        skip_cache=skip_cache,
        activity_type=activity_type,
        city_slug=city_slug,
        tenant_id=tenant_id,
        department_id=department_id,
        department_ids=department_ids,
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
    city_bike_counts: dict[str, int] = {}
    city_run_counts: dict[str, int] = {}
    city_trend: dict[str, int] = {}
    flagged_device_ids: list[str] = []
    ride_states_by_device: dict[str, str] = {}
    try:
        from activities import simulator_state as sim_state
        from activities.ride_fsm import fsm_summary, normalize_ride_state

        rides_map = sim_state.get_live_rides()
        fsm = fsm_summary(rides_map)
        ride_on_map = fsm["ride_on_map"]
        ride_warming = fsm["ride_warming"]
        city_counts = sim_state.get_live_city_counts()
        activity_by_city = sim_state.get_live_city_activity_counts()
        city_bike_counts = {slug: int(v.get("bike", 0)) for slug, v in activity_by_city.items()}
        city_run_counts = {slug: int(v.get("run", 0)) for slug, v in activity_by_city.items()}
        city_trend = sim_state.get_live_city_trend()
        flagged_device_ids = sim_state.get_flagged_live_device_ids()
        ride_states_by_device = {
            str(uid): normalize_ride_state(ride) for uid, ride in rides_map.items()
        }
    except Exception:
        pass

    flagged_set = frozenset(flagged_device_ids)
    enriched_data = []
    viewport_bike = 0
    viewport_run = 0
    detail = req.detail
    scope_active = bool(
        req.tenant_id or req.department_id is not None or req.department_ids
    )
    viewport_total_before_filter = 0
    viewport_filtered_out = 0

    from activities.live_map_rbac import position_matches_scope

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
        if scope_active:
            viewport_total_before_filter += 1
            pos_tenant, pos_dept = _pos_scope_fields(pos)
            if not position_matches_scope(
                req.tenant_id,
                req.department_id,
                pos_tenant,
                pos_dept,
                department_ids=req.department_ids,
            ):
                viewport_filtered_out += 1
                continue
        info = device_info.get(device_id, {})
        type_label = pos.get("category") or pos.get("type") or info.get("type", "person")
        kind = _position_activity_kind(str(type_label))
        if req.activity_type and kind != req.activity_type:
            continue
        if req.city_slug:
            try:
                from simulate_active_cities import nearest_city_slug_for_coords

                if nearest_city_slug_for_coords(lat, lng) != req.city_slug:
                    continue
            except Exception:
                pass
        if kind == "bike":
            viewport_bike += 1
        else:
            viewport_run += 1
        ride_state = ride_states_by_device.get(str(device_id))
        speed = _live_float(pos, "speed", default=0.0)
        course = _live_float(pos, "course", default=0.0)
        flagged = str(device_id) in flagged_set
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
            if flagged:
                row["flagged"] = True
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
            if flagged:
                row["flagged"] = True
            enriched_data.append(row)

    viewport_returned = len(enriched_data)
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
    elif telemetry_meta.get("cached") and viewport_returned > 0:
        read_mode = "cached"
    elif telemetry_meta.get("capped"):
        read_mode = "viewport_capped"

    if telemetry_meta.get("cached") and not enriched_data:
        telemetry_meta = {**telemetry_meta, "cached": False, "cache_stale_empty": True}

    viewport_total_estimate = None
    if telemetry_meta.get("capped"):
        raw_total = telemetry_meta.get("telemetry_positions") or telemetry_meta.get("redis_active")
        if isinstance(raw_total, (int, float)) and raw_total > viewport_returned:
            viewport_total_estimate = int(raw_total)

    active_filters: dict[str, str] = {}
    if req.activity_type:
        active_filters["activity_type"] = req.activity_type
    if req.city_slug:
        active_filters["city"] = req.city_slug
    if req.tenant_id:
        active_filters["tenant_id"] = req.tenant_id
    if req.department_id is not None:
        active_filters["department_id"] = str(req.department_id)

    filters_applied = dict(active_filters)
    if req.department_ids and req.department_id is None:
        filters_applied["department_ids"] = ",".join(str(i) for i in sorted(req.department_ids))

    render_mode = "points"
    aggregate_url = None
    if viewport_total_estimate is not None and viewport_total_estimate >= 10_000:
        render_mode = "aggregate"
    elif viewport_returned >= 2000 and telemetry_meta.get("capped"):
        render_mode = "aggregate"
    elif detail in ("standard", "summary") or viewport_returned > 50:
        render_mode = "clusters"
    if render_mode == "aggregate":
        agg_params = []
        if req.bbox_tuple:
            agg_params.append(f"bbox={','.join(str(x) for x in req.bbox_tuple)}")
        if req.tenant_id:
            agg_params.append(f"tenant_id={req.tenant_id}")
        if req.department_id is not None:
            agg_params.append(f"department_id={req.department_id}")
        agg_params.append("mode=h3")
        aggregate_url = "/api/activities/telemetry/live/aggregate/?" + "&".join(agg_params)

    try:
        from activities.live_map_timescale import timescale_available

        ts_available = timescale_available()
    except Exception:
        ts_available = False

    return {
        "positions": enriched_data,
        "meta": {
            **telemetry_meta,
            "timescale_available": ts_available,
            "positions_returned": viewport_returned,
            "viewport_returned": viewport_returned,
            "detail": detail,
            "redis_active": active_riding,
            "active_riding": active_riding,
            "ride_on_map": ride_on_map,
            "ride_warming": ride_warming,
            "viewport_bike": viewport_bike,
            "viewport_run": viewport_run,
            "city_counts": city_counts,
            "city_bike_counts": city_bike_counts,
            "city_run_counts": city_run_counts,
            "city_trend": city_trend,
            "flagged_device_ids": flagged_device_ids,
            "flagged_in_viewport": sum(
                1 for p in enriched_data if isinstance(p, dict) and p.get("flagged")
            ),
            "viewport_total_estimate": viewport_total_estimate,
            "filters": active_filters,
            "filters_applied": filters_applied,
            "viewport_total_before_filter": (
                viewport_total_before_filter if scope_active else None
            ),
            "viewport_filtered_out": viewport_filtered_out if scope_active else None,
            "render_mode": render_mode,
            "aggregate_url": aggregate_url,
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
