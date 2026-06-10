"""
Live simulator launch planner — derives max-throughput settings from deployed infra (env).

No abstract intensity/load profiles: the admin wizard sends these concrete values.
"""

from __future__ import annotations

import math
import os
from typing import Any


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def read_infra_capacity() -> dict[str, Any]:
    """Snapshot of simulation/routing capacity from process environment."""
    from activities.scale_config import (
        MAX_CONCURRENT_RIDERS,
        MAX_TELEMETRY_PUBLISH_PER_TICK,
        resolve_live_scale_limits,
    )
    from activities.simulator_route_waypoints import _async_routing_enabled
    from activities.simulator_routing_backpressure import (
        max_routing_dispatch_per_tick,
        max_routing_queue_depth,
        routing_backlog_boost_cap,
    )

    limits = resolve_live_scale_limits({})
    dispatch_cap = max_routing_dispatch_per_tick(limits)
    queue_cap = max_routing_queue_depth()
    tick_seconds = optimal_tick_seconds()

    return {
        "max_concurrent_riders": MAX_CONCURRENT_RIDERS,
        "max_telemetry_per_tick": MAX_TELEMETRY_PUBLISH_PER_TICK,
        "max_starts_per_live_tick": int(limits["max_starts_per_live_tick"]),
        "brouter_max_calls_per_tick": int(limits["brouter_max_calls_per_tick"]),
        "brouter_route_attempts": int(limits["brouter_route_attempts"]),
        "routing_dispatch_per_tick": dispatch_cap,
        "routing_queue_depth_cap": queue_cap,
        "routing_backlog_boost_cap": routing_backlog_boost_cap(),
        "async_routing": bool(_async_routing_enabled()),
        "tick_seconds": tick_seconds,
        "starts_per_second": round(
            int(limits["max_starts_per_live_tick"]) / max(1, tick_seconds), 2
        ),
    }


def optimal_tick_seconds() -> int:
    """Fastest stable tick interval for async routing on current infra."""
    raw = _int_env("SCALE_SIM_OPTIMAL_TICK_SECONDS", 2)
    return max(2, min(12, raw))


def build_live_launch_plan(
    target_users: int,
    *,
    active_ratio: float,
    cheat_ratio: float,
    pool_pct: float = 1.0,
) -> dict[str, Any]:
    """
    Max-throughput live sim plan for the wizard.

    Uses full env caps (Railway simulation worker vars) — no profile curve throttling.
    """
    from activities.scale_config import MAX_CONCURRENT_RIDERS

    infra = read_infra_capacity()
    target_users = max(1, int(target_users))
    active_ratio = max(0.05, min(0.50, float(active_ratio)))
    cheat_ratio = max(0.0, min(0.25, float(cheat_ratio)))
    pool_pct = max(0.1, min(1.0, float(pool_pct)))

    target_on_map = min(
        MAX_CONCURRENT_RIDERS,
        max(1, int(target_users * pool_pct * active_ratio)),
    )
    tick_seconds = infra["tick_seconds"]
    max_starts = infra["max_starts_per_live_tick"]

    scale_overrides = {
        "max_starts_per_live_tick": max_starts,
        "brouter_max_calls_per_tick": infra["brouter_max_calls_per_tick"],
        "brouter_route_attempts": infra["brouter_route_attempts"],
    }

    # Async routing: ramp limited by dispatch + worker pool (~70% efficiency heuristic).
    dispatch = infra["routing_dispatch_per_tick"]
    routes_per_tick = min(max_starts, dispatch) if infra["async_routing"] else max_starts
    effective_starts_per_sec = routes_per_tick / max(1, tick_seconds)
    if effective_starts_per_sec > 0:
        ramp_seconds = int(
            math.ceil(target_on_map / effective_starts_per_sec * 1.35)
        )
    else:
        ramp_seconds = 0

    return {
        "pool_pct": pool_pct,
        "active_ratio": round(active_ratio, 4),
        "cheat_ratio": round(cheat_ratio, 4),
        "tick_seconds": tick_seconds,
        "scale_overrides": scale_overrides,
        "target_on_map": target_on_map,
        "infra": infra,
        "estimated_ramp_seconds": ramp_seconds,
        "throughput": {
            "starts_per_tick": max_starts,
            "routes_dispatched_per_tick": routes_per_tick,
            "starts_per_second": infra["starts_per_second"],
        },
    }
