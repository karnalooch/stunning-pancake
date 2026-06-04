"""
Routing queue backpressure for live simulator (Paczka 1b).

Limits new route_live_ride_task dispatches when Redis FSM pending depth and/or
Celery broker queue depth exceed configured caps.
"""

from __future__ import annotations

import logging
import os
from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger("activities.simulator")

_BACKPRESSURE_LOG_INTERVAL_S = 60.0
_last_backpressure_log_at = 0.0


def max_routing_queue_depth() -> int | None:
    """
    Max combined pending depth before throttling dispatches.
    Unset in Dashboard still uses code default 200 (avoids stale prod cap=80).
    Set to 0 to disable depth-based backpressure.
    """
    raw = os.getenv("SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH", "200")
    if not str(raw).strip():
        return 200
    try:
        cap = int(raw)
    except (TypeError, ValueError):
        return None
    if cap <= 0:
        return None
    return cap


def max_routing_dispatch_per_tick(scale_limits: dict) -> int:
    """Per-tick cap on new PENDING_ROUTE + route_live_ride_task.delay calls."""
    try:
        cap = int(os.getenv("SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK", "150"))
    except (TypeError, ValueError):
        cap = 0
    if cap <= 0:
        cap = int(scale_limits.get("max_starts_per_live_tick") or 30)
    return max(1, cap)


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def backpressure_min_dispatch_per_tick() -> int:
    """Floor on routing dispatches per tick while backpressure is active (never fully stall)."""
    return max(0, _int_env("SIM_BP_MIN_DISPATCH_PER_TICK", 12))


def backpressure_drain_dispatch_per_tick() -> int:
    """Target dispatches per tick when depth is at cap (slightly over)."""
    return max(0, _int_env("SIM_BP_DRAIN_DISPATCH_PER_TICK", 20))


def backpressure_queue_headroom() -> int:
    """Extra depth above cap before applying the minimum dispatch floor."""
    return max(0, _int_env("SIM_BP_QUEUE_HEADROOM", 25))


def get_broker_routing_queue_depth() -> int | None:
    """Celery Redis list length for queue `routing`; None if broker unavailable."""
    try:
        from django.conf import settings

        broker_url = getattr(settings, "CELERY_BROKER_URL", "") or ""
        if not broker_url or broker_url.startswith("memory://"):
            return None
        parsed = urlparse(broker_url)
        if parsed.scheme not in ("redis", "rediss"):
            return None
        import redis

        db = 0
        if parsed.path and parsed.path != "/":
            try:
                db = int(parsed.path.lstrip("/") or 0)
            except ValueError:
                db = 0
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        password = parsed.password
        client = redis.Redis(
            host=host,
            port=port,
            password=password,
            db=db,
            socket_connect_timeout=1.0,
            socket_timeout=1.0,
        )
        return int(client.llen("routing") or 0)
    except Exception:
        return None


def routing_backpressure_snapshot(
    *,
    fsm_pending: int,
    fsm_routing: int = 0,
) -> dict[str, Any]:
    """
    Snapshot for status API and live tick dispatch decisions.

    When the Celery broker is readable, depth = broker LLEN + in-flight ROUTING tasks
    (undispatched PENDING_ROUTE does not inflate depth — starts can queue separately).
    Otherwise falls back to full FSM warming count.
    """
    broker_depth = get_broker_routing_queue_depth()
    if broker_depth is None:
        depth = int(fsm_pending)
    else:
        depth = int(broker_depth) + max(0, int(fsm_routing))
    max_depth = max_routing_queue_depth()
    active = bool(max_depth is not None and depth >= max_depth)
    return {
        "routing_queue_depth": depth,
        "routing_broker_queue_depth": broker_depth,
        "routing_fsm_pending": int(fsm_pending),
        "routing_fsm_routing": int(fsm_routing),
        "routing_backpressure_active": active,
        "max_routing_queue_depth": max_depth,
    }


def effective_routing_dispatch_cap(
    base_cap: int,
    snapshot: dict[str, Any],
    *,
    starters_remaining: int,
) -> tuple[int, bool]:
    """
    Returns (effective_cap, dispatches_will_be_throttled).

    When backpressure is active, throttle dispatches but keep a drain budget so
    riders still ramp up while the routing queue drains (avoid full stall at cap).
    """
    base_cap = max(0, int(base_cap))
    if not snapshot.get("routing_backpressure_active"):
        return base_cap, False

    depth = int(snapshot.get("routing_queue_depth") or 0)
    max_depth = snapshot.get("max_routing_queue_depth")
    if max_depth is None or int(max_depth) <= 0:
        return base_cap, False

    max_depth = int(max_depth)
    drain_cap = backpressure_drain_dispatch_per_tick()
    min_cap = backpressure_min_dispatch_per_tick()
    headroom = backpressure_queue_headroom()

    if depth <= max_depth:
        return base_cap, False

    if depth >= max_depth + headroom:
        effective = min(base_cap, min_cap)
    else:
        # Between cap and cap+headroom: partial throttle (helps queue drain).
        effective = min(base_cap, max(min_cap, drain_cap))

    throttled = starters_remaining > 0 and effective < base_cap
    return max(0, effective), throttled


def routing_backlog_boost_cap() -> int:
    """Max dispatches/tick when broker is shallow but Redis has a large PENDING backlog."""
    return max(50, _int_env("SCALE_SIM_ROUTING_BACKLOG_BOOST_CAP", 500))


def should_pause_new_starts(*, warming_count: int, pending_count: int = 0) -> bool:
    """Stop adding PENDING_ROUTE until routing drains (prevents 2k warming / 0 ACTIVE)."""
    warm_thr = _int_env("SCALE_SIM_PAUSE_STARTS_WARMING_ABOVE", 350)
    pend_thr = _int_env("SCALE_SIM_PAUSE_STARTS_PENDING_ABOVE", 300)
    return int(warming_count) >= warm_thr or int(pending_count) >= pend_thr


def resolve_routing_dispatch_cap(
    base_cap: int,
    snapshot: dict[str, Any],
    *,
    pending_route_count: int,
    starters_remaining: int,
) -> tuple[int, bool, bool]:
    """
    Returns (effective_cap, queue_throttled, backlog_boosted).

    When Celery broker depth is low but many rides sit in PENDING_ROUTE, raise the
    per-tick dispatch cap (otherwise 150/tick vs 1800 backlog → map stays at 0).
    """
    cap, queue_throttled = effective_routing_dispatch_cap(
        base_cap,
        snapshot,
        starters_remaining=starters_remaining,
    )
    pending = max(0, int(pending_route_count))
    if pending <= cap:
        return cap, queue_throttled, False

    max_depth = snapshot.get("max_routing_queue_depth")
    depth = int(snapshot.get("routing_queue_depth") or 0)
    shallow_broker = max_depth is None or depth < max(20, int(max_depth) // 4)
    if shallow_broker and not snapshot.get("routing_backpressure_active"):
        boosted = min(routing_backlog_boost_cap(), pending)
        if boosted > cap:
            return boosted, queue_throttled, True
    return cap, queue_throttled, False


def start_budget_mode() -> str:
    """active_on_map (default): fast ramp — warming does not block new starts. all_in_flight: legacy."""
    raw = os.getenv("SCALE_SIM_START_BUDGET_MODE", "active_on_map").strip().lower()
    return raw if raw in ("active_on_map", "all_in_flight") else "active_on_map"


def max_pipeline_rides(target_on_map: int) -> int:
    """Hard cap on Redis live_rides hash (ACTIVE + pipeline) — memory / stability."""
    try:
        mult = float(os.getenv("SCALE_SIM_MAX_PIPELINE_MULTIPLIER", "2.5"))
    except (TypeError, ValueError):
        mult = 2.5
    try:
        abs_cap = int(os.getenv("SCALE_SIM_MAX_PIPELINE_ABSOLUTE", "2000"))
    except (TypeError, ValueError):
        abs_cap = 2000
    try:
        headroom = int(os.getenv("SCALE_SIM_MAX_PIPELINE_HEADROOM", "150"))
    except (TypeError, ValueError):
        headroom = 150
    mult = max(1.0, min(5.0, mult))
    return min(abs_cap, max(target_on_map + headroom, int(target_on_map * mult) + headroom))


def compute_live_start_budget(
    *,
    total_users: int,
    active_ratio: float,
    max_riders: int,
    active_on_map: int,
    pipeline_count: int,
    global_start_cap: int,
    event_stagger_cap: int | None = None,
) -> dict[str, Any]:
    """
    How many new rides to start this tick (before city balancing).

    Fast path (active_on_map): fill toward target ACTIVE count; pipeline capped separately.
    Legacy (all_in_flight): target minus full hash length (warming blocks starts).
    """
    target_on_map = min(max_riders, max(1, int(total_users * active_ratio)))
    mode = start_budget_mode()
    if mode == "all_in_flight":
        demand_gap = max(0, target_on_map - int(pipeline_count))
    else:
        demand_gap = max(0, target_on_map - int(active_on_map))

    max_pipe = max_pipeline_rides(target_on_map)
    pipeline_room = max(0, max_pipe - int(pipeline_count))
    needed = min(demand_gap, pipeline_room)

    if event_stagger_cap is not None:
        needed = min(needed, int(event_stagger_cap))
    if global_start_cap > 0:
        needed = min(needed, int(global_start_cap))

    return {
        "target_on_map": target_on_map,
        "starts_budget": max(0, needed),
        "slots_free_on_map": max(0, target_on_map - int(active_on_map)),
        "pipeline_count": int(pipeline_count),
        "max_pipeline_rides": max_pipe,
        "pipeline_room": pipeline_room,
        "start_budget_mode": mode,
        "pipeline_capped": demand_gap > 0 and pipeline_room < demand_gap,
    }


def maybe_log_routing_backpressure(
    *,
    snapshot: dict[str, Any],
    skipped: int,
    base_cap: int,
) -> None:
    """Structured log + live_log when dispatches were throttled (rate-limited)."""
    global _last_backpressure_log_at
    if skipped <= 0:
        return
    import time

    from activities import simulator_state as sim

    now = time.time()
    eff = snapshot.get("effective_dispatch_cap", base_cap)
    depth = snapshot.get("routing_queue_depth")
    if snapshot.get("routing_backpressure_active"):
        msg = (
            f"Routing throttle: skipped {skipped} dispatches "
            f"(depth={depth}, depth_cap={snapshot.get('max_routing_queue_depth')}, "
            f"tick_cap={base_cap}, effective={eff})"
        )
    else:
        msg = (
            f"Routing dispatch cap: skipped {skipped} backlog dispatches "
            f"(depth={depth}, tick_cap={base_cap}, queued>{base_cap})"
        )
    if now - _last_backpressure_log_at >= _BACKPRESSURE_LOG_INTERVAL_S:
        _last_backpressure_log_at = now
        sim.live_log(msg)
    logger.info(
        "sim.routing.backpressure",
        extra={
            "skipped": skipped,
            "routing_queue_depth": snapshot.get("routing_queue_depth"),
            "routing_fsm_pending": snapshot.get("routing_fsm_pending"),
            "routing_broker_queue_depth": snapshot.get("routing_broker_queue_depth"),
            "max_routing_queue_depth": snapshot.get("max_routing_queue_depth"),
        },
    )
