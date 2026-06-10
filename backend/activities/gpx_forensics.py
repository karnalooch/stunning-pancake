"""GPX forensics helpers — fingerprint, metadata checks (P2 F3)."""

from __future__ import annotations

import hashlib
import json
import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from activities.models import Activity


def route_fingerprint(route_path) -> str:
    """Stable hash of simplified route coordinates."""
    if route_path is None or route_path.num_coords < 2:
        return ""
    coords = [(round(c[0], 5), round(c[1], 5)) for c in route_path.coords]
    payload = json.dumps(coords, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def gpx_track_distance_m(route_path) -> float:
    if route_path is None or route_path.num_coords < 2:
        return 0.0
    total = 0.0
    coords = list(route_path.coords)
    for i in range(1, len(coords)):
        total += _haversine_m(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0])
    return total


_SPEED_LIMIT_MPS = {
    "RUN": 12.0,
    "BIKE": 25.0,
    "WALK": 3.5,
    "WHEELCHAIR": 8.0,
}


def _max_segment_speed_mps(route_path, interval_s: float = 1.0) -> float:
    if route_path is None or route_path.num_coords < 2 or interval_s <= 0:
        return 0.0
    coords = list(route_path.coords)
    peak = 0.0
    for i in range(1, len(coords)):
        dist = _haversine_m(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0])
        peak = max(peak, dist / interval_s)
    return peak


def is_simulated_activity(activity: Activity) -> bool:
    """Heuristic: simulator batch users / sim-lab tenants."""
    from activities.sim_integration_mode import sim_users_are_synthetic

    if not sim_users_are_synthetic():
        return False

    user = getattr(activity, "user", None)
    if user and str(getattr(user, "username", "")).lower().startswith("sim_"):
        return True
    tenant = getattr(activity, "tenant", None)
    if tenant:
        tid = str(getattr(tenant, "id", "") or "").lower()
        if "sim" in tid or tid.endswith("-lab"):
            return True
    ext = str(getattr(activity, "external_id", "") or "")
    return ext.startswith("sim:") or ext.startswith("simulator:")


def scan_activity_forensics(activity: Activity) -> list[str]:
    """Return human-readable flags for moderator / logging."""
    flags: list[str] = []
    if not activity.route_path or activity.route_path.num_coords < 2:
        return flags

    fp = route_fingerprint(activity.route_path)
    if fp:
        from activities.models import Activity

        dup = (
            Activity.objects.filter(route_fingerprint=fp)
            .exclude(pk=activity.pk)
            .exclude(user_id=activity.user_id)
            .exists()
        )
        if dup:
            flags.append("duplicate_route_fingerprint")

    track_m = gpx_track_distance_m(activity.route_path)
    if activity.distance and activity.distance > 0 and track_m > 0:
        ratio = abs(track_m - float(activity.distance)) / float(activity.distance)
        if ratio > 0.15:
            flags.append(f"metadata_distance_mismatch:{ratio:.2f}")

    act_type = str(getattr(activity, "type", "RUN") or "RUN").upper()
    peak = _max_segment_speed_mps(activity.route_path)
    limit = _SPEED_LIMIT_MPS.get(act_type, 15.0)
    if peak > limit * 1.25:
        flags.append(f"kinematic_speed_anomaly:{peak:.1f}mps")

    if getattr(activity, "external_id", None) and getattr(activity, "external_source", None):
        flags.append("wearable_imported")

    if is_simulated_activity(activity):
        flags.append("simulated_activity")

    return flags
