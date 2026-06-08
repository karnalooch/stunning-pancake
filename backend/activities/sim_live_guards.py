"""
Live simulator safety clamps (large pools, OSRM warm-up).
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass

LARGE_POOL_MIN_USERS = 5000


@dataclass(frozen=True)
class LargePoolClampResult:
    active_ratio: float
    tick_seconds: int
    applied: bool
    notes: tuple[str, ...]


def clamp_live_params_for_large_pool(
    total_users: int,
    active_ratio: float,
    tick_seconds: int,
    *,
    threshold: int | None = None,
) -> LargePoolClampResult:
    """
    Reduce live-sim aggression after large batch pools (e.g. 10k cities test).
    Skipped when operator uses sim_intensity/sim_load profile (caller checks).
    """
    limit = (
        threshold
        if threshold is not None
        else int(os.getenv("SCALE_SIM_LARGE_POOL_MIN_USERS", str(LARGE_POOL_MIN_USERS)))
    )
    if total_users < limit:
        return LargePoolClampResult(active_ratio, tick_seconds, False, ())

    notes: list[str] = []
    ar = active_ratio
    ts = tick_seconds
    max_ar = float(os.getenv("SCALE_SIM_LARGE_POOL_MAX_ACTIVE_RATIO", "0.25"))
    min_tick = int(os.getenv("SCALE_SIM_LARGE_POOL_MIN_TICK_SECONDS", "10"))
    if ar > max_ar:
        ar = max_ar
        notes.append(f"active_ratio capped to {max_ar} (pool>={limit})")
    if ts < min_tick:
        ts = min_tick
        notes.append(f"tick_seconds raised to {min_tick} (pool>={limit})")
    return LargePoolClampResult(ar, ts, bool(notes), tuple(notes))


@dataclass(frozen=True)
class OsrmReadyWaitResult:
    ready: bool
    waited_seconds: float
    attempts: int
    detail: str | None = None


def wait_for_osrm_ready(*, max_wait_seconds: float | None = None) -> OsrmReadyWaitResult:
    """
    Poll OSRM /health after Railway scale-up. Workers should use routing backend `auto`
    until this returns ready.
    """
    from activities.osrm_service import OsrmService
    from activities.sim_routing import sim_routing_backend

    if sim_routing_backend() == "brouter":
        return OsrmReadyWaitResult(True, 0.0, 0, "backend=brouter")

    try:
        cap = float(
            max_wait_seconds
            if max_wait_seconds is not None
            else os.getenv("RAILWAY_OSRM_READY_MAX_WAIT_S", "90")
        )
    except (TypeError, ValueError):
        cap = 90.0
    cap = max(0.0, min(cap, 300.0))
    try:
        interval = float(os.getenv("RAILWAY_OSRM_READY_POLL_S", "5"))
    except (TypeError, ValueError):
        interval = 5.0
    interval = max(2.0, min(interval, 30.0))

    if cap <= 0:
        ok = OsrmService.health_check(force=True)
        return OsrmReadyWaitResult(ok, 0.0, 1, None if ok else "health failed (no wait)")

    started = time.time()
    deadline = started + cap
    attempts = 0
    while time.time() < deadline:
        attempts += 1
        if OsrmService.health_check(force=True):
            return OsrmReadyWaitResult(True, time.time() - started, attempts)
        time.sleep(interval)

    return OsrmReadyWaitResult(
        False,
        time.time() - started,
        attempts,
        f"OSRM not healthy after {cap:.0f}s — use SCALE_SIM_ROUTING_BACKEND=auto on workers",
    )
