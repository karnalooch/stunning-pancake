"""
Celery Tasks for Simulator
==========================
Facade: registers task names under activities.simulator_tasks.* for Celery routes.
Implementations live in simulator_batch_tasks, simulator_live_orchestrator, simulator_live_tick.
"""

import logging
import time

import requests
from celery import shared_task
from celery.exceptions import WorkerLostError
from django.utils import timezone

from . import ride_fsm, simulator_state as sim
from .simulator_batch_tasks import (  # noqa: F401 — Celery registration
    run_batch_city_users,
    run_batch_finalize,
    run_batch_simulation,
)
from .simulator_live_orchestrator import (  # noqa: F401
    live_tick_task,
    run_live_simulation,
)
from .simulator_route_waypoints import (  # noqa: F401 — re-export for tests/admin
    STRICT_ROAD_ROUTES,
    _async_routing_enabled,
    _brouter_route_waypoints,
    _brouter_tick_budget_remaining,
    _compute_live_motion,
    _consume_brouter_tick_budget,
    _generate_grid_waypoints,
    _generate_road_waypoints,
    _generate_route_waypoints,
    _haversine_m,
    _instant_active_on_route_enabled,
    _interpolate_along_polyline,
    _jitter_point_km,
    _maybe_log_brouter_grid_fallback,
    _maybe_log_brouter_route_failure,
    _ramp_start_delay_max,
    _reset_brouter_tick_budget,
    _sample_athlete_motion_profile,
)

logger = logging.getLogger("activities.simulator")


def _telemetry_entry_from_ride(user_id: int, ride: dict) -> dict:
    act = str(ride.get("act_type", "BIKE") or "BIKE").strip().lower()
    sim_type = "bike" if act in ("bike", "bicycle", "cycling") else "run"
    speed_kmh = ride.get("speed_kmh")
    if not isinstance(speed_kmh, (int, float)):
        speed_kmh = 22.0 if sim_type == "bike" else 10.0
    return {
        "deviceId": str(user_id),
        "name": f"Athlete {user_id}",
        "type": sim_type,
        "lat": float(ride.get("lat", 52.2297)),
        "lng": float(ride.get("lon", 21.0122)),
        "speed": float(speed_kmh) / 3.6,
        "course": 0,
        "tenantId": ride.get("tenant_id"),
        "departmentId": ride.get("primary_department_id"),
    }


def _push_ride_telemetry_merge(user_id: int, ride: dict) -> None:
    """Publish one ACTIVE rider immediately (async routing); live tick still does full snapshot."""
    from activities.services import TelemetryService

    try:
        TelemetryService.replace_active_positions(
            [_telemetry_entry_from_ride(user_id, ride)],
            merge=True,
        )
    except Exception:
        logger.exception("sim.routing.telemetry_push_failed", extra={"user_id": user_id})


def _route_pending_ride(user_id: int, ride: dict) -> None:
    """BRouter on dedicated worker — no live-tick HTTP budget."""
    lat0 = float(ride.get("anchor_lat", ride.get("lat", 52.2297)))
    lon0 = float(ride.get("anchor_lon", ride.get("lon", 21.0122)))
    distance_m = float(ride.get("distance_m", 5000))
    act_type = ride.get("act_type", "RUN")
    start_radius_km = ride.get("start_radius_km")
    waypoints, route_source = _generate_route_waypoints(
        lat0,
        lon0,
        distance_m,
        act_type,
        anchor_lat=lat0,
        anchor_lon=lon0,
        start_radius_km=start_radius_km,
        city_slug=ride.get("city_slug"),
        use_tick_budget=False,
    )
    current = sim.get_live_ride(user_id) or ride
    if ride_fsm.normalize_ride_state(current) != ride_fsm.ROUTING:
        return
    if waypoints and len(waypoints) >= 2 and route_source != "unroutable":
        start_lat, start_lon = waypoints[0][0], waypoints[0][1]
        now_dt = timezone.now()
        payload = {
            **current,
            "waypoints": waypoints,
            "route_source": route_source,
            "lat": start_lat,
            "lon": start_lon,
        }
        if _instant_active_on_route_enabled():
            payload["ride_state"] = ride_fsm.ACTIVE
            payload["start_time"] = now_dt.isoformat()
        else:
            payload["ride_state"] = ride_fsm.ROUTED
        sim.set_live_ride(user_id, payload)
        if payload.get("ride_state") == ride_fsm.ACTIVE:
            _push_ride_telemetry_merge(user_id, payload)
        return
    sim.set_live_ride(user_id, {**current, "ride_state": ride_fsm.FAILED_UNROUTABLE})
    if route_source == "unroutable":
        sim.increment_live_routing_counter("routing_unroutable_total")
    else:
        sim.increment_live_routing_counter("routing_transport_errors_total")
    sim.delete_live_ride(user_id)


@shared_task(
    bind=True,
    queue="routing",
    max_retries=3,
    autoretry_for=(WorkerLostError, requests.exceptions.RequestException),
    retry_backoff=True,
    retry_jitter=True,
)
def route_live_ride_task(self, user_id: int):
    """Pre-compute road polyline off the live tick (queue: routing)."""
    if not sim.get_live_state().get("running"):
        sim.delete_live_ride(user_id)
        return
    ride = sim.get_live_ride(user_id)
    if not ride or not ride_fsm.can_dispatch_routing(ride):
        return
    sim.set_live_ride(
        user_id,
        {**ride, "ride_state": ride_fsm.ROUTING, "routing_since": time.time()},
    )
    try:
        _route_pending_ride(user_id, ride)
    except Exception as exc:
        logger.exception("sim.routing.task_failed", extra={"user_id": user_id})
        sim.delete_live_ride(user_id)
        sim.increment_live_routing_counter("routing_transport_errors_total")
        sim.live_log(f"Routing task failed for {user_id}: {exc!s:.120}")
