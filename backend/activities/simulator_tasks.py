"""
Celery Tasks for Simulator
============================
Background tasks that run the simulation logic with real-time telemetry.
"""

import logging
import os
import random
import time

import requests
from celery import shared_task
from celery.exceptions import WorkerLostError
from django.utils import timezone

from . import simulator_state as sim
from . import ride_fsm

logger = logging.getLogger("activities.simulator")


from .simulator_live_tick import _run_live_tick_body
from .simulator_route_waypoints import (  # noqa: F401 — re-export for tests/admin
    STRICT_ROAD_ROUTES,
    _async_routing_enabled,
    _brouter_route_waypoints,
    _brouter_tick_budget_remaining,
    _consume_brouter_tick_budget,
    _generate_grid_waypoints,
    _generate_route_waypoints,
    _generate_road_waypoints,
    _haversine_m,
    _interpolate_along_polyline,
    _maybe_log_brouter_grid_fallback,
    _maybe_log_brouter_route_failure,
    _reset_brouter_tick_budget,
    _ramp_start_delay_max,
    _sample_athlete_motion_profile,
    _compute_live_motion,
    _instant_active_on_route_enabled,
    _jitter_point_km,
)


@shared_task(bind=True, queue="simulation", max_retries=0)
def run_batch_city_users(
    self, city_slug, users_per_city, scale, city_index, total_cities, total_target_users
):
    """Create users for one city (parallel batch phase)."""
    from activities.scale_disk_monitor import check_simulation_allowed
    from simulate_active_cities import create_users_for_city

    allowed, reason = check_simulation_allowed("simulator")
    if not allowed:
        sim.batch_log(f"ERROR disk guard: {reason}")
        raise RuntimeError(reason)

    def on_progress(**kwargs):
        sim.set_batch_state(**{k: v for k, v in kwargs.items() if v is not None})

    try:
        count = create_users_for_city(
            city_slug,
            int(users_per_city),
            float(scale),
            city_index=int(city_index),
            total_cities=int(total_cities),
            total_target_users=int(total_target_users),
            progress_callback=on_progress,
        )
        sim.batch_log(f"City {city_slug}: {count} users")
        return count
    except Exception as e:
        sim.batch_log(f"ERROR city {city_slug}: {e}")
        raise


@shared_task(bind=True, queue="simulation", max_retries=0)
def run_batch_finalize(self, city_results, skip_activities=False):
    """Chord callback after parallel city user creation."""
    from users.models import User
    from activities.models import Activity

    try:
        city_total = sum(int(x or 0) for x in (city_results or []))
        sim.batch_log(f"Parallel cities done: {city_total} users in workers")

        user_count = User.objects.filter(role="ATHLETE").count()
        activity_count = Activity.objects.count()

        sim.set_batch_state(
            current_phase="complete",
            progress_pct=100,
            users_created=user_count,
            activities_created=activity_count,
            running=False,
            completed_at=time.time(),
        )
        sim.batch_log(f"Done: {user_count} users, {activity_count} activities")
        from activities.admin_stats import invalidate_dashboard_stats_cache

        invalidate_dashboard_stats_cache()
        return {"status": "complete", "users": user_count, "activities": activity_count}
    except Exception as e:
        sim.set_batch_state(error=str(e), running=False, completed_at=time.time())
        sim.batch_log(f"ERROR finalize: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        sim.release_batch_lock()


@shared_task(bind=True, queue="simulation", max_retries=0)
def run_batch_simulation(
    self, scale=0.01, days=30, clear=False, skip_activities=False, total_users=None
):
    """Generate tenants, departments, users, and activities."""
    from simulate_active_cities import run
    from users.models import User
    from activities.scale_config import compute_batch_scaling

    if not sim.acquire_batch_lock():
        sim.batch_log("ERROR: batch lock — another simulation running")
        sim.set_batch_state(error="Another simulation is running", running=False)
        return {"status": "locked"}

    from activities.scale_disk_monitor import check_simulation_allowed, run_disk_monitor

    run_disk_monitor(source="simulator")
    allowed, reason = check_simulation_allowed("simulator")
    if not allowed:
        sim.batch_log(f"ERROR disk guard: {reason}")
        sim.set_batch_state(error=reason, running=False)
        sim.release_batch_lock()
        return {"status": "disk_guard", "error": reason}

    target = int(total_users or 0)
    batch_plan = compute_batch_scaling(target) if target else {}

    if target >= 1_000:
        from activities.scale_disk_guard import prepare_batch_disk_guard

        sim.set_batch_state(current_phase="disk_guard", progress_pct=1)
        sim.batch_log("Sprawdzanie miejsca na dysku Postgres…")
        guard = prepare_batch_disk_guard(
            target,
            skip_activities=skip_activities,
            clear=clear,
        )
        for action in guard.get("actions") or []:
            sim.batch_log(action)
        if not guard.get("ok"):
            err = guard.get("error", "Disk guard blocked batch")
            sim.set_batch_state(error=err, running=False, completed_at=time.time())
            sim.batch_log(f"ERROR disk guard: {err}")
            sim.release_batch_lock()
            return {"status": "disk_guard", "error": err}
        batch_plan = guard.get("batch_plan") or batch_plan
        sim.set_batch_state(
            user_bulk_pg_batch_size=batch_plan.get("user_bulk_pg_batch_size"),
            user_bulk_batch_size=batch_plan.get("user_bulk_batch_size"),
            max_parallel_workers=batch_plan.get("max_parallel_workers"),
            disk_usage_ratio=guard.get("disk_usage_ratio"),
            db_size_gb=guard.get("db_size_gb"),
        )

    use_parallel = bool(skip_activities and target and batch_plan.get("use_parallel_cities"))
    parallel_started = False

    try:
        sim.reset_batch_state()
        sim.set_batch_state(
            running=True,
            started_at=time.time(),
            scale=scale,
            days=days,
            total_users=target,
            current_phase="initializing",
            progress_pct=0,
            users_created=0,
        )
        if batch_plan:
            eta_min = max(1, batch_plan["estimated_batch_seconds"] // 60)
            sim.batch_log(
                f"Batch plan: {batch_plan['num_cities']} cities × "
                f"{batch_plan['users_per_city']:,} users, "
                f"bulk={batch_plan['user_bulk_batch_size']:,}, "
                f"parallel≤{batch_plan['max_parallel_workers']}, "
                f"ETA~{eta_min}min"
            )
        sim.batch_log(f"Batch starting: scale={scale}, days={days}, total_users={total_users}")

        last_logged_phase = [None]

        def on_progress(**kwargs):
            phase = kwargs.get("current_phase", "")
            if phase and phase != last_logged_phase[0]:
                last_logged_phase[0] = phase
                sim.batch_log(f"Phase: {phase}")
            sim.set_batch_state(**{k: v for k, v in kwargs.items() if v is not None})

        sim.set_batch_state(current_phase="generating", progress_pct=2, total_users=target)

        if use_parallel:
            from celery import chord, group

            plan = run(
                scale=scale,
                days=days,
                clear=clear,
                dry_run=False,
                skip_activities=True,
                skip_user_creation=True,
                total_users=total_users,
                progress_callback=on_progress,
            )
            slugs = plan["city_slugs"]
            users_per_city = plan["users_per_city"]
            plan_scale = plan["scale"]
            total_u = plan["total_u"]
            sim.batch_log(f"Parallel user creation: {len(slugs)} cities × {users_per_city} users")
            sim.set_batch_state(current_phase="creating_users", progress_pct=22)

            header = group(
                run_batch_city_users.s(
                    slug,
                    users_per_city,
                    plan_scale,
                    idx,
                    len(slugs),
                    total_u,
                )
                for idx, slug in enumerate(slugs)
            )
            chord(header)(run_batch_finalize.s(skip_activities=skip_activities))
            parallel_started = True
            return {"status": "parallel_started", "cities": len(slugs)}

        run(
            scale=scale,
            days=days,
            clear=clear,
            dry_run=False,
            skip_activities=skip_activities,
            total_users=total_users,
            progress_callback=on_progress,
        )

        user_count = User.objects.filter(role="ATHLETE").count()
        from activities.models import Activity

        activity_count = Activity.objects.count()

        sim.set_batch_state(
            current_phase="complete",
            progress_pct=100,
            users_created=user_count,
            activities_created=activity_count,
            running=False,
            completed_at=time.time(),
        )
        sim.batch_log(f"Done: {user_count} users, {activity_count} activities")
        from activities.admin_stats import invalidate_dashboard_stats_cache

        invalidate_dashboard_stats_cache()
        return {"status": "complete", "users": user_count, "activities": activity_count}

    except Exception as e:
        sim.set_batch_state(error=str(e), running=False, completed_at=time.time())
        sim.batch_log(f"ERROR: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        if not parallel_started:
            sim.release_batch_lock()


@shared_task(
    bind=True,
    queue="simulation",
    max_retries=2,
    autoretry_for=(WorkerLostError,),
    retry_backoff=True,
    retry_jitter=True,
)
def run_live_simulation(
    self, total_users=100, active_ratio=0.25, cheat_ratio=0.05, tick_seconds=10
):
    """Orchestrator — non-blocking tick chain. Each invocation runs one tick and schedules the next."""
    from activities.scale_disk_monitor import check_simulation_allowed, run_disk_monitor
    from users.models import User

    run_disk_monitor(source="simulator")
    allowed, reason = check_simulation_allowed("simulator")
    if not allowed:
        sim.live_log(f"Disk guard: {reason}")
        sim.set_live_state(running=False, error=reason)
        sim.release_live_lock()
        return {"status": "disk_guard", "error": reason}

    state = sim.get_live_state()

    # Stopped / aborted — drain chained Celery tasks without re-acquiring the lock
    if not state.get("running"):
        sim.release_live_lock()
        return {"status": "stopped"}

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

    # One-time pool setup (POST already set running=True and holds the lock)
    if not sim.is_live_pool_db_mode() and sim.get_live_pool_count() == 0:
        from activities.scale_config import compute_batch_scaling

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
        from activities.scale_config import resolve_live_scale_limits

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

    sim.set_live_state(last_tick_at=time.time())

    if not sim.get_live_state().get("running", False):
        sim.release_live_lock()
        return {"status": "stopped"}

    self.apply_async(countdown=tick_seconds)
    return {"status": "tick_complete", "next_tick_in": tick_seconds}


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


@shared_task(
    bind=True,
    queue="simulation",
    max_retries=2,
    autoretry_for=(WorkerLostError,),
    retry_backoff=True,
    retry_jitter=True,
)
def live_tick_task(self):
    """One tick: finish rides, start new ones, push telemetry to Redis."""
    if not sim.acquire_live_tick_lock():
        return

    _reset_brouter_tick_budget()
    try:
        with sim.live_rides_tick_cache():
            _run_live_tick_body()
    finally:
        sim.set_live_state(last_tick_at=time.time())
        sim.release_live_tick_lock()


