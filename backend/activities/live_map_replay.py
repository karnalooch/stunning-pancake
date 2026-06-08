"""
Server-side Live Map replay and compare (Timescale warm path).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Any

from activities.live_map_api import LiveMapRequest, parse_live_map_query_params
from activities.live_map_rbac import position_matches_scope

logger = logging.getLogger(__name__)

_STEP_MS = {"5s": 5000, "30s": 30000, "60s": 60000, "5": 5000, "30": 30000, "60": 60000}


@dataclass(frozen=True)
class ReplayRequest:
    base: LiveMapRequest
    time_from: datetime
    time_to: datetime
    step_ms: int
    compare_offset: timedelta | None = None


def _parse_iso_dt(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=dt_timezone.utc)
        return dt
    except (TypeError, ValueError):
        return None


def parse_replay_query_params(query_params, *, user=None) -> ReplayRequest | None:
    base = parse_live_map_query_params(query_params, user=user)
    time_from = _parse_iso_dt(query_params.get("from") or query_params.get("time_from"))
    time_to = _parse_iso_dt(query_params.get("to") or query_params.get("time_to"))
    if not time_from or not time_to or time_to <= time_from:
        return None

    step_raw = (query_params.get("step") or "30s").strip().lower()
    step_ms = _STEP_MS.get(step_raw, 30000)

    compare_offset = None
    offset_raw = (query_params.get("compare_offset") or "").strip().lower()
    if offset_raw in ("", "24h", "1d"):
        compare_offset = timedelta(hours=24)
    elif offset_raw.endswith("h"):
        try:
            compare_offset = timedelta(hours=int(offset_raw[:-1]))
        except ValueError:
            compare_offset = timedelta(hours=24)

    return ReplayRequest(
        base=base,
        time_from=time_from,
        time_to=time_to,
        step_ms=step_ms,
        compare_offset=compare_offset,
    )


def _interval_literal(step_ms: int) -> str:
    if step_ms <= 5000:
        return "5 seconds"
    if step_ms <= 30000:
        return "30 seconds"
    return "60 seconds"


def _scope_sql_filters(req: LiveMapRequest) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if req.tenant_id:
        clauses.append("tenant_id = %s::uuid")
        params.append(req.tenant_id)
    if req.department_id is not None:
        clauses.append("department_id = %s")
        params.append(req.department_id)
    elif req.department_ids:
        placeholders = ",".join(["%s"] * len(req.department_ids))
        clauses.append(f"department_id IN ({placeholders})")
        params.extend(sorted(req.department_ids))
    where_extra = (" AND " + " AND ".join(clauses)) if clauses else ""
    return where_extra, params


def _query_frames(
    req: ReplayRequest,
    *,
    time_from: datetime,
    time_to: datetime,
) -> list[dict[str, Any]]:
    from django.db import connection

    if not req.base.bbox_tuple:
        return []

    west, south, east, north = req.base.bbox_tuple
    interval = _interval_literal(req.step_ms)
    scope_sql, scope_params = _scope_sql_filters(req.base)

    sql = f"""
        SELECT
            time_bucket(%s::interval, time) AS bucket,
            device_id,
            last(lat, time) AS lat,
            last(lng, time) AS lng,
            last(speed, time) AS speed,
            last(course, time) AS course,
            last(act_type, time) AS act_type,
            last(tenant_id::text, time) AS tenant_id,
            last(department_id, time) AS department_id,
            last(city_slug, time) AS city_slug,
            last(flagged, time) AS flagged
        FROM telemetry.live_position_events
        WHERE time >= %s AND time < %s
          AND lng BETWEEN %s AND %s
          AND lat BETWEEN %s AND %s
          {scope_sql}
        GROUP BY bucket, device_id
        ORDER BY bucket ASC
    """
    params: list[Any] = [
        interval,
        time_from,
        time_to,
        west,
        east,
        south,
        north,
        *scope_params,
    ]

    frames_by_bucket: dict[datetime, list[dict]] = {}
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            for row in cursor.fetchall():
                (
                    bucket,
                    device_id,
                    lat,
                    lng,
                    speed,
                    course,
                    act_type,
                    tenant_id,
                    dept_id,
                    city_slug,
                    flagged,
                ) = row
                pos = {
                    "deviceId": str(device_id),
                    "lat": float(lat) if lat is not None else 0.0,
                    "lng": float(lng) if lng is not None else 0.0,
                    "speed": float(speed or 0),
                    "course": float(course or 0),
                    "type": act_type or "bike",
                }
                if flagged:
                    pos["flagged"] = True
                if not position_matches_scope(
                    req.base.tenant_id,
                    req.base.department_id,
                    tenant_id,
                    int(dept_id) if dept_id is not None else None,
                    department_ids=req.base.department_ids,
                ):
                    continue
                frames_by_bucket.setdefault(bucket, []).append(pos)
    except Exception as exc:
        logger.warning("live_map.replay.query_failed err=%s", exc)
        return []

    frames = []
    for bucket in sorted(frames_by_bucket.keys()):
        positions = frames_by_bucket[bucket]
        at = bucket.isoformat().replace("+00:00", "Z")
        frames.append({"at": at, "positions": positions, "meta": {"count": len(positions)}})
    return frames


def _count_in_window(req: ReplayRequest, time_from: datetime, time_to: datetime) -> int:
    from django.db import connection

    if not req.base.bbox_tuple:
        return 0
    west, south, east, north = req.base.bbox_tuple
    scope_sql, scope_params = _scope_sql_filters(req.base)
    sql = f"""
        SELECT COUNT(DISTINCT device_id)
        FROM telemetry.live_position_events
        WHERE time >= %s AND time < %s
          AND lng BETWEEN %s AND %s
          AND lat BETWEEN %s AND %s
          {scope_sql}
    """
    params: list[Any] = [time_from, time_to, west, east, south, north, *scope_params]
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return int(row[0]) if row and row[0] is not None else 0
    except Exception:
        return 0


def _city_deltas(
    req: ReplayRequest,
    time_from: datetime,
    time_to: datetime,
    baseline_from: datetime,
    baseline_to: datetime,
) -> dict[str, int]:
    from django.db import connection

    if not req.base.bbox_tuple:
        return {}
    west, south, east, north = req.base.bbox_tuple
    scope_sql, scope_params = _scope_sql_filters(req.base)

    def _counts(tf: datetime, tt: datetime) -> dict[str, int]:
        sql = f"""
            SELECT city_slug, COUNT(DISTINCT device_id)
            FROM telemetry.live_position_events
            WHERE time >= %s AND time < %s
              AND lng BETWEEN %s AND %s
              AND lat BETWEEN %s AND %s
              AND city_slug IS NOT NULL AND city_slug <> ''
              {scope_sql}
            GROUP BY city_slug
        """
        params: list[Any] = [tf, tt, west, east, south, north, *scope_params]
        out: dict[str, int] = {}
        try:
            with connection.cursor() as cursor:
                cursor.execute(sql, params)
                for slug, cnt in cursor.fetchall():
                    out[str(slug)] = int(cnt)
        except Exception:
            pass
        return out

    current = _counts(time_from, time_to)
    baseline = _counts(baseline_from, baseline_to)
    deltas: dict[str, int] = {}
    for slug in set(current) | set(baseline):
        deltas[slug] = current.get(slug, 0) - baseline.get(slug, 0)
    return {k: v for k, v in deltas.items() if v != 0}


def build_replay_payload(req: ReplayRequest) -> dict[str, Any]:
    from activities.live_map_timescale import timescale_replay_available

    available = timescale_replay_available() and _replay_enabled()
    if not available:
        return {
            "frames": [],
            "step_ms": req.step_ms,
            "meta": {"timescale_available": False},
        }

    started = datetime.now(dt_timezone.utc)
    frames = _query_frames(req, time_from=req.time_from, time_to=req.time_to)
    latency_ms = int((datetime.now(dt_timezone.utc) - started).total_seconds() * 1000)
    logger.info("live_map.replay.latency_ms=%s frames=%s", latency_ms, len(frames))

    return {
        "frames": frames,
        "step_ms": req.step_ms,
        "meta": {
            "timescale_available": True,
            "frame_count": len(frames),
            "latency_ms": latency_ms,
        },
    }


def build_compare_payload(req: ReplayRequest) -> dict[str, Any]:
    body = build_replay_payload(req)
    if not body["meta"].get("timescale_available"):
        return body

    offset = req.compare_offset or timedelta(hours=24)
    baseline_from = req.time_from - offset
    baseline_to = req.time_to - offset

    current_count = _count_in_window(req, req.time_from, req.time_to)
    baseline_count = _count_in_window(req, baseline_from, baseline_to)
    city_deltas = _city_deltas(req, req.time_from, req.time_to, baseline_from, baseline_to)

    body["compare"] = {
        "baseline_count": baseline_count,
        "current_count": current_count,
        "delta": current_count - baseline_count,
        "city_deltas": city_deltas,
        "compare_offset_hours": int(offset.total_seconds() // 3600),
    }
    return body


def _replay_enabled() -> bool:
    from core.models import FeatureFlag

    return FeatureFlag.is_enabled("live_map_server_replay") or FeatureFlag.is_enabled(
        "live_map_timescale_writer"
    )
