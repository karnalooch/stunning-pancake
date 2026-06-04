"""
Live simulation orchestrator — schedules tick chain without blocking workers.
Extracted from simulator_tasks.py (Q-P1-8).
"""

from __future__ import annotations

import logging
import time

from celery import shared_task
from celery.exceptions import WorkerLostError

from . import simulator_state as sim
from .simulator_route_waypoints import (
    _async_routing_enabled,
    _reset_brouter_tick_budget,
)

logger = logging.getLogger("activities.simulator")


@shared_task(
    bind=True,
    queue="simulation",
    max_retries=2,
    autoretry_for=(WorkerLostError,),
    retry_backoff=True,
    retry_jitter=True,
    name="activities.simulator_tasks.run_live_simulation",
)
def run_live_simulation(
    self, total_users=100, active_ratio=0.25, cheat_ratio=0.05, tick_seconds=10
):
    """Orchestrator — non-blocking tick chain. Each invocation runs one tick and schedules the next."""
    from activities.scale_disk_monitor import check_simulation_allowed, run_disk_monitor

    run_disk_monitor(source="simulator")
    allowed, reason = check_simulation_allowed("simulator")
    if not allowed:
        sim.live_log(f"Disk guard: {reason}")
        sim.set_live_state(running=False, error=reason)
        sim.release_live_lock()
        return {"status": "disk_guard", "error": reason}

    state = sim.get_live_state()

    if not state.get("running"):
        sim.release_live_lock()
        return {"status": "stopped"}

    sim.set_live_state(last_runner_at=time.time())

    blocked, block_reason = sim.batch_blocks_live_simulation()
    if blocked:
        sim.live_log(f"Live sim stopped: {block_reason} (finish batch first)")
        sim.set_live_state(running=False, error=f"Blocked by batch: {block_reason}")
        sim.release_live_lock()
        return {"status": "blocked", "reason": block_reason}

    tick_seconds = int(state.get("tick_seconds") or tick_seconds)
    active_ratio = float(state.get("active_ratio") or active_ratio)
    cheat_ratio = float(state.get("cheat_ratio") or cheat_ratio)
    pool_target = int(state.get("total_users") or total_users)

    if not sim.is_live_pool_db_mode() and sim.get_live_pool_count() == 0:
        from activities.scale_config import compute_batch_scaling, resolve_live_scale_limits

        pool_plan = compute_batch_scaling(max(pool_target, 1))
        if pool_plan["live_pool_mode"] == "db":
            pool_size = sim.init_live_pool_db_mode(pool_target)
            mode_note = "db sampling per city"
        else:
            pool_limit = pool_plan["live_pool_redis_cap"]
            pool_size = sim.set_live_pool_from_db(pool_limit)
            mode_note = f"redis pool (cap {pool_limit})"
        sim.set_live_state(total_users=pool_size)
        if pool_size < pool_target:
            sim.live_log(
                f"WARNING: only {pool_size} athletes available (wanted {pool_target}). "
                f"Stop live sim and restart after batch completes to refresh the pool."
            )
        limits = resolve_live_scale_limits(sim.get_live_state())
        max_riders_hint = max(1, int(pool_size * active_ratio))
        sim.live_log(
            f"LIVE SIM: {mode_note}, n={pool_size}, {active_ratio * 100:.0f}% active (capped), "
            f"{cheat_ratio * 100:.0f}% cheaters, tick={tick_seconds}s "
            f"(~{max_riders_hint} riders on map at once if all start) · "
            f"starts/tick≤{limits['max_starts_per_live_tick']}, "
            f"brouter/tick≤{limits['brouter_max_calls_per_tick']}, "
            f"route tries={limits['brouter_route_attempts']}, "
            f"async_routing={'on' if _async_routing_enabled() else 'off'}"
        )

    if not sim.get_live_state().get("running", False):
        sim.release_live_lock()
        return {"status": "stopped"}

    blocked, block_reason = sim.batch_blocks_live_simulation()
    if blocked:
        sim.live_log(f"Live sim stopped before tick: {block_reason}")
        sim.set_live_state(running=False, error=f"Blocked by batch: {block_reason}")
        sim.release_live_lock()
        return {"status": "blocked", "reason": block_reason}

    try:
        live_tick_task.delay()
        sim.refresh_live_lock()
    except Exception as e:
        sim.live_log(f"Tick error: {e}")

    sim.set_live_state(last_runner_at=time.time())

    if not sim.get_live_state().get("running", False):
        sim.release_live_lock()
        return {"status": "stopped"}

    self.apply_async(countdown=tick_seconds)
    return {"status": "tick_complete", "next_tick_in": tick_seconds}


@shared_task(
    bind=True,
    queue="simulation",
    max_retries=2,
    autoretry_for=(WorkerLostError,),
    retry_backoff=True,
    retry_jitter=True,
    name="activities.simulator_tasks.live_tick_task",
)
def live_tick_task(self):
    """One tick: finish rides, start new ones, push telemetry to Redis."""
    from activities.simulator_live_tick import _run_live_tick_body

    if not sim.acquire_live_tick_lock():
        return

    _reset_brouter_tick_budget()
    try:
        with sim.live_rides_tick_cache():
            _run_live_tick_body()
    finally:
        sim.set_live_state(last_tick_at=time.time())
        sim.release_live_tick_lock()
