"""
Shared Redis route templates for live simulator (reduces BRouter HTTP under load).

Templates are keyed by city + activity type + distance bucket. Many riders in the same
city reuse one successful polyline with anchor offset jitter.
"""

from __future__ import annotations

import json
import os
from typing import Any

from core.redis_cluster import get_redis

_ROUTE_KEY_PREFIX = "{sim}:route_tpl:"


def route_template_cache_enabled() -> bool:
    return os.getenv("SCALE_SIM_ROUTE_TEMPLATE_CACHE", "1").lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


def _distance_bucket(distance_m: float) -> int:
    try:
        d = float(distance_m)
    except (TypeError, ValueError):
        d = 5000.0
    step = max(250, int(os.getenv("SCALE_SIM_ROUTE_TEMPLATE_BUCKET_M", "500")))
    return int(max(step, round(d / step) * step))


def template_cache_key(
    *,
    city_slug: str,
    activity_type: str,
    distance_m: float,
) -> str:
    slug = (city_slug or "unknown").strip().lower()[:64]
    act = (activity_type or "RUN").strip().upper()[:16]
    bucket = _distance_bucket(distance_m)
    return f"{_ROUTE_KEY_PREFIX}{slug}:{act}:{bucket}"


def get_route_template(
    *,
    city_slug: str,
    activity_type: str,
    distance_m: float,
) -> dict[str, Any] | None:
    if not route_template_cache_enabled() or not city_slug:
        return None
    try:
        raw = get_redis().get(
            template_cache_key(
                city_slug=city_slug,
                activity_type=activity_type,
                distance_m=distance_m,
            )
        )
    except Exception:
        return None
    if not raw:
        return None
    try:
        data = json.loads(raw.decode() if isinstance(raw, bytes) else raw)
    except (json.JSONDecodeError, TypeError, ValueError):
        return None
    wps = data.get("waypoints")
    if not isinstance(wps, list) or len(wps) < 2:
        return None
    return data


def set_route_template(
    *,
    city_slug: str,
    activity_type: str,
    distance_m: float,
    anchor_lat: float,
    anchor_lon: float,
    waypoints: list[tuple[float, float]],
    source: str = "road",
) -> None:
    if not route_template_cache_enabled() or not city_slug or len(waypoints) < 2:
        return
    try:
        ttl = max(3600, int(os.getenv("SCALE_SIM_ROUTE_TEMPLATE_TTL_S", "86400")))
    except (TypeError, ValueError):
        ttl = 86400
    payload = {
        "anchor_lat": float(anchor_lat),
        "anchor_lon": float(anchor_lon),
        "waypoints": [[float(a), float(b)] for a, b in waypoints],
        "source": source,
    }
    try:
        get_redis().setex(
            template_cache_key(
                city_slug=city_slug,
                activity_type=activity_type,
                distance_m=distance_m,
            ),
            ttl,
            json.dumps(payload, separators=(",", ":")),
        )
    except Exception:
        pass


def apply_route_template(
    template: dict[str, Any],
    *,
    anchor_lat: float,
    anchor_lon: float,
) -> list[tuple[float, float]]:
    """Shift cached polyline so it starts near the rider anchor."""
    raw = template.get("waypoints") or []
    base_lat = float(template.get("anchor_lat", anchor_lat))
    base_lon = float(template.get("anchor_lon", anchor_lon))
    dlat = float(anchor_lat) - base_lat
    dlon = float(anchor_lon) - base_lon
    out: list[tuple[float, float]] = []
    for pt in raw:
        if not isinstance(pt, (list, tuple)) or len(pt) < 2:
            continue
        out.append((float(pt[0]) + dlat, float(pt[1]) + dlon))
    return out if len(out) >= 2 else []
