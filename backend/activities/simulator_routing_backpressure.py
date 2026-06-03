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
    Unset or 0 = disabled (dispatch cap only applies per tick, not queue depth).
    """
    raw = os.getenv("SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH", "")
    if not str(raw).strip():
        return None
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
        cap = int(os.getenv("SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK", "0"))
    except (TypeError, ValueError):
        cap = 0
    if cap <= 0:
        cap = int(scale_limits.get("max_starts_per_live_tick") or 30)
    return max(1, cap)


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


def routing_backpressure_snapshot(*, fsm_pending: int) -> dict[str, Any]:
    """
    Snapshot for status API and live tick dispatch decisions.

    routing_queue_depth = max(FSM warming, broker depth) when broker is readable.
    """
    broker_depth = get_broker_routing_queue_depth()
    if broker_depth is None:
        depth = int(fsm_pending)
    else:
        depth = max(int(fsm_pending), int(broker_depth))
    max_depth = max_routing_queue_depth()
    active = bool(max_depth is not None and depth >= max_depth)
    return {
        "routing_queue_depth": depth,
        "routing_broker_queue_depth": broker_depth,
        "routing_fsm_pending": int(fsm_pending),
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

    When backpressure is active, no new routing tasks are queued this tick.
    """
    base_cap = max(0, int(base_cap))
    if not snapshot.get("routing_backpressure_active"):
        return base_cap, False
    if starters_remaining > 0 and base_cap > 0:
        return 0, True
    return 0, False


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
    msg = (
        f"Routing backpressure: skipped {skipped} dispatches "
        f"(depth={snapshot.get('routing_queue_depth')}, "
        f"cap={snapshot.get('max_routing_queue_depth')}, per_tick_cap={base_cap})"
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
