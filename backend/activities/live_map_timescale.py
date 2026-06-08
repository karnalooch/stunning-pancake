"""
Timescale warm path for Live Map — snapshot writer + availability checks.
"""

from __future__ import annotations

import logging
import math
import time
from datetime import datetime, timezone as dt_timezone
from typing import Any

logger = logging.getLogger(__name__)

_SNAPSHOT_DEDUPE_PREFIX = "{livemap}:ts:snap:"
_TABLE = "telemetry.live_position_events"


def timescale_table_exists() -> bool:
    try:
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'telemetry'
                  AND table_name = 'live_position_events'
                LIMIT 1
                """
            )
            return cursor.fetchone() is not None
    except Exception:
        return False


def timescale_writer_enabled() -> bool:
    from core.models import FeatureFlag

    return FeatureFlag.is_enabled("live_map_timescale_writer")


def timescale_replay_available() -> bool:
    """Warm path readable (replay/compare UI)."""
    from core.models import FeatureFlag

    if not timescale_table_exists():
        return False
    return FeatureFlag.is_enabled("live_map_server_replay") or FeatureFlag.is_enabled(
        "live_map_timescale_writer"
    )


def timescale_available() -> bool:
    """Alias for live meta — replay or writer warm path ready."""
    return timescale_replay_available()


def _bucket_ts(epoch: float) -> datetime:
    floored = int(epoch // 10) * 10
    return datetime.fromtimestamp(floored, tz=dt_timezone.utc)


def _dedupe_key(bucket_epoch: int, device_id: str) -> str:
    return f"{_SNAPSHOT_DEDUPE_PREFIX}{bucket_epoch}:{device_id}"


def _parse_position_row(
    device_id: str,
    pos: dict,
    *,
    rides_map: dict,
    flagged_ids: frozenset[str],
    bucket_time: datetime,
) -> tuple | None:
    try:
        lat = float(pos.get("latitude", pos.get("lat", 0)))
        lng = float(pos.get("longitude", pos.get("lng", 0)))
    except (TypeError, ValueError):
        return None
    if not (math.isfinite(lat) and math.isfinite(lng)):
        return None
    if lat == 0.0 and lng == 0.0:
        return None

    ride = rides_map.get(str(device_id), {})
    raw_type = str(pos.get("type") or pos.get("category") or ride.get("act_type") or "bike")
    act_type = raw_type.lower()
    if act_type in ("bicycle", "cycling", "cyclist"):
        act_type = "bike"
    elif act_type in ("running", "runner", "walk", "walking", "foot", "person"):
        act_type = "run" if act_type != "person" else "person"

    tenant_raw = pos.get("tenantId") or pos.get("tenant_id") or ride.get("tenant_id")
    tenant_id = str(tenant_raw) if tenant_raw else None
    dept_raw = (
        pos.get("departmentId") if pos.get("departmentId") is not None else pos.get("department_id")
    )
    if dept_raw is None:
        dept_raw = ride.get("primary_department_id")
    department_id = int(dept_raw) if dept_raw is not None else None

    from activities.ride_fsm import normalize_ride_state

    ride_state = normalize_ride_state(ride) if ride else None
    city_slug = ride.get("city_slug") if ride else None
    try:
        speed = float(pos.get("speed", 0) or 0)
    except (TypeError, ValueError):
        speed = 0.0
    try:
        course = float(pos.get("course", 0) or 0)
    except (TypeError, ValueError):
        course = 0.0

    return (
        bucket_time,
        str(device_id),
        lat,
        lng,
        speed,
        course,
        act_type,
        tenant_id,
        department_id,
        ride_state,
        str(device_id) in flagged_ids,
        city_slug,
    )


def snapshot_live_positions_to_timescale(*, max_rows: int = 5000) -> dict[str, Any]:
    """
    Batch Redis telemetry shards into Timescale (10s buckets, deduped per device).
    """

    if not timescale_writer_enabled():
        return {"status": "disabled", "rows_written": 0}

    if not timescale_table_exists():
        return {"status": "unavailable", "rows_written": 0}

    from activities.services import TelemetryService

    positions = TelemetryService.scan_all_live_positions(limit=max_rows)
    if not positions:
        return {"status": "empty", "rows_written": 0}

    rides_map: dict = {}
    flagged_ids: frozenset[str] = frozenset()
    try:
        from activities import simulator_state as sim_state

        rides_map = sim_state.get_live_rides()
        flagged_ids = frozenset(sim_state.get_flagged_live_device_ids())
    except Exception:
        pass

    now_epoch = time.time()
    bucket_time = _bucket_ts(now_epoch)
    bucket_epoch = int(now_epoch // 10) * 10

    rows: list[tuple] = []
    for pos in positions:
        if not isinstance(pos, dict):
            continue
        device_id = pos.get("deviceId") or pos.get("id")
        if not device_id:
            continue
        row = _parse_position_row(
            str(device_id),
            pos,
            rides_map=rides_map,
            flagged_ids=flagged_ids,
            bucket_time=bucket_time,
        )
        if row:
            rows.append(row)

    if not rows:
        return {"status": "empty", "rows_written": 0}

    try:
        from core.redis_cluster import get_redis

        r = get_redis()
        pipe = r.pipeline(transaction=False)
        dedupe_keys = [_dedupe_key(bucket_epoch, row[1]) for row in rows]
        for key in dedupe_keys:
            pipe.set(key, "1", nx=True, ex=15)
        flags = pipe.execute()
        rows = [row for row, ok in zip(rows, flags) if ok]
    except Exception:
        pass

    if not rows:
        return {"status": "deduped", "rows_written": 0}

    insert_sql = f"""
        INSERT INTO {_TABLE} (
            time, device_id, lat, lng, speed, course,
            act_type, tenant_id, department_id, ride_state, flagged, city_slug
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s::uuid, %s, %s, %s, %s
        )
        ON CONFLICT (time, device_id) DO NOTHING
    """

    written = 0
    try:
        from django.db import connection

        with connection.cursor() as cursor:
            for row in rows:
                try:
                    cursor.execute(insert_sql, row)
                    written += cursor.rowcount
                except Exception as exc:
                    logger.debug("live_map.snapshot.row_skip err=%s", exc)
        logger.info(
            "live_map.snapshot.rows_written=%s scanned=%s bucket=%s",
            written,
            len(positions),
            bucket_epoch,
        )
    except Exception as exc:
        logger.warning("live_map.snapshot.failed err=%s", exc)
        return {"status": "error", "rows_written": 0, "error": str(exc)[:200]}

    return {"status": "ok", "rows_written": written, "scanned": len(positions)}
