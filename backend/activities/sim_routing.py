"""
Live simulator road routing — pluggable backend (OSRM / BRouter).

User anti-cheat continues to use BRouterService only.
"""

from __future__ import annotations

import os
from collections.abc import Callable

from activities.osrm_service import OsrmService
from activities.services import BRouterService

RoadRouteFn = Callable[
    [float, float, float, float, str, bool],
    list[tuple[float, float]] | None,
]


def sim_routing_backend() -> str:
    """
    brouter | osrm | auto | template

    - brouter: BRouter HTTP (default, matches anti-cheat graph)
    - osrm: OSRM HTTP only (high throughput for sim)
    - auto: OSRM when OSRM_URL health OK, else BRouter
    - template: no road HTTP — sim_route_cache + grid fallback only
    """
    raw = (os.getenv("SCALE_SIM_ROUTING_BACKEND") or "brouter").strip().lower()
    if raw in ("brouter", "osrm", "auto", "template"):
        return raw
    return "brouter"


def _osrm_route_waypoints(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    activity_type: str,
    *,
    use_tick_budget: bool = True,
) -> list[tuple[float, float]] | None:
    from activities.simulator_route_waypoints import _consume_brouter_tick_budget

    if use_tick_budget and not _consume_brouter_tick_budget():
        return None
    coords = [[start_lon, start_lat], [end_lon, end_lat]]
    result = OsrmService.route_coordinates(activity_type, coords)
    if result.get("success"):
        waypoints = result.get("coordinates")
        if waypoints and len(waypoints) >= 2:
            return waypoints
    err = result.get("error") or "unknown"
    from activities.simulator_route_waypoints import _maybe_log_brouter_route_failure

    _maybe_log_brouter_route_failure(
        f"{OsrmService.base_url()} (osrm) -> {err}",
        unroutable="NoRoute" in str(err) or "NoSegment" in str(err),
    )
    return None


def resolve_road_route_fn() -> RoadRouteFn | None:
    """Return callable for A→B leg routing, or None when template-only (no HTTP)."""
    backend = sim_routing_backend()
    if backend == "template":
        return None
    if backend == "osrm":
        return _osrm_route_waypoints
    if backend == "auto":
        if OsrmService.health_check():
            return _osrm_route_waypoints
        from activities.simulator_route_waypoints import _brouter_route_waypoints

        return _brouter_route_waypoints
    from activities.simulator_route_waypoints import _brouter_route_waypoints

    return _brouter_route_waypoints


def road_route_waypoints(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    activity_type: str,
    *,
    use_tick_budget: bool = True,
) -> list[tuple[float, float]] | None:
    fn = resolve_road_route_fn()
    if fn is None:
        return None
    return fn(
        start_lat,
        start_lon,
        end_lat,
        end_lon,
        activity_type,
        use_tick_budget=use_tick_budget,
    )
