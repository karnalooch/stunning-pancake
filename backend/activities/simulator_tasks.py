"""
Celery Tasks for Simulator
============================
Background tasks that run the simulation logic with real-time telemetry.
"""

import logging
import math
import os
import random
import time
from datetime import timedelta

from celery import shared_task
from celery.exceptions import WorkerLostError
from django.utils import timezone
from django.core.cache import cache

from . import simulator_state as sim
from . import ride_fsm
from . import simulator_routing_backpressure as routing_bp
from .services import BRouterService

logger = logging.getLogger("activities.simulator")

_EARTH_RADIUS_M = 6_371_000.0
STRICT_ROAD_ROUTES = os.getenv("SCALE_SIM_STRICT_ROAD_ROUTES", "1").lower() in (
    "1",
    "true",
    "yes",
    "on",
)

# Per-tick BRouter HTTP budget (reset at start of each live_tick_task).
_tick_brouter_calls = 0
_tick_brouter_budget: int | None = None

_brouter_grid_log_count = 0
_brouter_grid_log_last_hour = 0.0
_brouter_route_fail_log_count = 0
_brouter_route_fail_log_last_hour = 0.0
_brouter_unroutable_log_count = 0
_brouter_unroutable_log_last_hour = 0.0


def _async_routing_enabled() -> bool:
    return os.getenv("SCALE_SIM_ASYNC_ROUTING", "1").lower() in ("1", "true", "yes", "on")


def _maybe_log_brouter_route_failure(reason: str, *, unroutable: bool = False) -> None:
    """Log why strict road-only mode skipped a start (throttled)."""
    global _brouter_route_fail_log_count, _brouter_route_fail_log_last_hour
    global _brouter_unroutable_log_count, _brouter_unroutable_log_last_hour
    if unroutable:
        _brouter_unroutable_log_count += 1
        if _brouter_unroutable_log_count <= 3:
            sim.live_log(f"BRouter unroutable: {reason[:200]}")
        else:
            now = time.time()
            if now - _brouter_unroutable_log_last_hour >= 3600:
                _brouter_unroutable_log_last_hour = now
                sim.live_log(f"BRouter unroutable (throttled): {reason[:160]}")
        logger.info(
            "sim.routing.unroutable",
            extra={"reason": reason[:240], "unroutable": True},
        )
        return
    _brouter_route_fail_log_count += 1
    if _brouter_route_fail_log_count <= 5:
        sim.live_log(f"BRouter routing failed: {reason[:240]}")
    else:
        now = time.time()
        if now - _brouter_route_fail_log_last_hour >= 3600:
            _brouter_route_fail_log_last_hour = now
            sim.live_log(f"BRouter routing failed (throttled): {reason[:240]}")
    logger.warning(
        "sim.routing.error",
        extra={"reason": reason[:240], "unroutable": False},
    )


def _maybe_log_brouter_grid_fallback() -> None:
    """Avoid live_log spam at scale — first 3 rides per worker, then at most once/hour."""
    global _brouter_grid_log_count, _brouter_grid_log_last_hour
    _brouter_grid_log_count += 1
    if _brouter_grid_log_count <= 3:
        sim.live_log(
            "BRouter unavailable — grid fallback "
            "(set BROUTER_URL on celery-worker-simulation, e.g. http://brouter:17777/brouter)"
        )
        return
    now = time.time()
    if now - _brouter_grid_log_last_hour < 3600:
        return
    _brouter_grid_log_last_hour = now
    sim.live_log(
        "BRouter unavailable — grid fallback (throttled; configure BROUTER_URL on simulation worker)"
    )


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    rlat1, rlon1, rlat2, rlon2 = map(math.radians, (lat1, lon1, lat2, lon2))
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(a))


def _interpolate_along_polyline(
    waypoints: list[tuple[float, float]],
    progress: float,
) -> tuple[float, float, int]:
    """Return (lat, lon, course°) at fraction progress (0–1) along polyline arc length."""
    if not waypoints:
        return 52.2297, 21.0122, 0
    if len(waypoints) == 1:
        return waypoints[0][0], waypoints[0][1], 0

    progress = max(0.0, min(1.0, progress))
    seg_lens = []
    for i in range(len(waypoints) - 1):
        a, b = waypoints[i], waypoints[i + 1]
        seg_lens.append(_haversine_m(a[0], a[1], b[0], b[1]))

    total = sum(seg_lens)
    if total <= 0:
        return waypoints[-1][0], waypoints[-1][1], 0

    target = progress * total
    walked = 0.0
    for i, seg_len in enumerate(seg_lens):
        if walked + seg_len >= target or i == len(seg_lens) - 1:
            frac = (target - walked) / seg_len if seg_len > 0 else 0.0
            frac = max(0.0, min(1.0, frac))
            lat_a, lon_a = waypoints[i]
            lat_b, lon_b = waypoints[i + 1]
            clat = lat_a + (lat_b - lat_a) * frac
            clon = lon_a + (lon_b - lon_a) * frac
            dlat = lat_b - lat_a
            dlon = lon_b - lon_a
            course = int((math.degrees(math.atan2(dlon, dlat)) + 360) % 360)
            return clat, clon, course
        walked += seg_len

    lat_a, lon_a = waypoints[-2]
    lat_b, lon_b = waypoints[-1]
    course = int((math.degrees(math.atan2(lon_b - lon_a, lat_b - lat_a)) + 360) % 360)
    return lat_b, lon_b, course


# ── Fast grid-based fallback waypoint generator (no external API) ──
def _generate_grid_waypoints(lat: float, lon: float) -> list[tuple[float, float]]:
    """Generate waypoints following a realistic city-street grid pattern."""
    block_size = 0.0015
    grid_steps = random.randint(6, 14)
    waypoints = [(lat, lon)]
    cur_lat, cur_lon = lat, lon
    for _ in range(grid_steps):
        seg = random.random()
        if seg < 0.4:
            cur_lat += block_size * random.choice([-1, 1])
            cur_lon += block_size * 0.12 * random.choice([-1, 1])
        elif seg < 0.8:
            cur_lon += block_size * random.choice([-1, 1])
            cur_lat += block_size * 0.12 * random.choice([-1, 1])
        else:
            cur_lat += block_size * 0.5 * random.choice([-1, 1])
            cur_lon += block_size * 0.5 * random.choice([-1, 1])
        waypoints.append((cur_lat, cur_lon))
    return waypoints


def _reset_brouter_tick_budget() -> None:
    global _tick_brouter_calls, _tick_brouter_budget
    from activities.scale_config import resolve_live_scale_limits

    limits = resolve_live_scale_limits(sim.get_live_state())
    _tick_brouter_calls = 0
    _tick_brouter_budget = int(limits["brouter_max_calls_per_tick"] or 0)


def _brouter_tick_budget_remaining() -> int | None:
    """None = unlimited; 0 = exhausted."""
    global _tick_brouter_budget
    if _tick_brouter_budget is None:
        _reset_brouter_tick_budget()
    if _tick_brouter_budget <= 0:
        return None
    return max(0, _tick_brouter_budget - _tick_brouter_calls)


def _consume_brouter_tick_budget() -> bool:
    """Return True if a BRouter HTTP call is allowed this tick."""
    global _tick_brouter_calls
    remaining = _brouter_tick_budget_remaining()
    if remaining is None:
        return True
    if remaining <= 0:
        return False
    _tick_brouter_calls += 1
    return True


def _brouter_profiles_for_activity(activity_type: str) -> list[str]:
    """Primary profile plus fallbacks when start cannot snap (HTTP 400 pass=0)."""
    primary = BRouterService.profile_for_activity(activity_type)
    profiles = [primary]
    if primary != "trekking":
        profiles.append("trekking")
    return profiles


def _brouter_route_waypoints(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    activity_type: str,
    *,
    use_tick_budget: bool = True,
) -> list[tuple[float, float]] | None:
    """Request a road-following polyline; first point is snapped onto the network."""
    if use_tick_budget and not _consume_brouter_tick_budget():
        return None
    coords = [[start_lon, start_lat], [end_lon, end_lat]]
    last_err = "unknown error"
    last_classification = None
    try:
        for profile in _brouter_profiles_for_activity(activity_type):
            result = BRouterService.validate_track(activity_type, coords, profile=profile)
            if result.get("success"):
                waypoints = result.get("coordinates")
                if not waypoints and result.get("raw_data"):
                    waypoints = BRouterService.extract_line_coordinates(result["raw_data"])
                if waypoints and len(waypoints) >= 2:
                    return waypoints
                last_err = f"empty route ({profile})"
                continue
            last_err = result.get("error") or "unknown error"
            last_classification = result.get("classification") or BRouterService.classify_error(
                last_err,
                result.get("status_code"),
            )
            if "pass=0" not in str(last_err).lower():
                break
            # Island / pass=0: profile fallback rarely helps — save HTTP budget for other starts.
            if (last_classification or {}).get("code") == BRouterService.UNROUTABLE_ERROR_CODE:
                break
        # "target island"/pass=0 are expected transient misses under dense concurrent starts.
        if (last_classification or {}).get("code") == BRouterService.UNROUTABLE_ERROR_CODE:
            _maybe_log_brouter_route_failure(
                f"{BRouterService.BASE_URL} -> unroutable start ({last_err})",
                unroutable=True,
            )
        else:
            _maybe_log_brouter_route_failure(
                f"{BRouterService.BASE_URL} -> {last_err}",
            )
    except Exception as exc:
        _maybe_log_brouter_route_failure(
            f"{BRouterService.BASE_URL} exception: {exc}",
        )
    return None


def _heal_stale_batch_running_flag() -> None:
    """Clear batch running=true when lock expired — unblocks live BRouter routing."""
    try:
        state = sim.get_batch_state()
        if state.get("running") and not sim.is_batch_lock_held():
            sim.set_batch_state(running=False, completed_at=time.time())
            sim.live_log("Cleared stale batch running flag (batch lock not held).")
    except Exception:
        pass


def _skip_brouter_now() -> bool:
    """
    Skip BRouter HTTP when explicitly disabled or a batch job holds the batch lock.
    Do not skip on stale running=true without lock (common after crashed batch).
    """
    if os.getenv("SCALE_SIM_SKIP_BROUTER", "").lower() in ("1", "true", "yes", "on"):
        return True
    try:
        if not sim.is_batch_lock_held():
            return False
        return bool(sim.get_batch_state().get("running"))
    except Exception:
        return False


# ── Road-following waypoint generator (uses BRouter for real road routes) ──
def _generate_route_waypoints(
    lat: float,
    lon: float,
    distance_m: float,
    activity_type: str,
    *,
    anchor_lat: float | None = None,
    anchor_lon: float | None = None,
    start_radius_km: float | None = None,
    use_tick_budget: bool = True,
) -> tuple[list[tuple[float, float]], str]:
    """
    Prefer BRouter road polyline from city center; grid fallback if unavailable.
    Returns (waypoints, source) where source is 'road' or 'grid'.
    Cached per (lat, lon, distance, type) for 1 hour.
    """
    if _skip_brouter_now():
        if STRICT_ROAD_ROUTES:
            if os.getenv("SCALE_SIM_SKIP_BROUTER", "").lower() in ("1", "true", "yes", "on"):
                _maybe_log_brouter_route_failure(
                    "SCALE_SIM_SKIP_BROUTER=1 (unset for live road routing)"
                )
            else:
                _maybe_log_brouter_route_failure(
                    "batch simulation running flag set (finish batch or POST simulator-reset)"
                )
            return [], "unroutable"
        grid = _generate_grid_waypoints(lat, lon)
        return grid, "grid"

    cache_key = f"road_wp:{lat:.4f}:{lon:.4f}:{int(distance_m)}:{activity_type}"
    cached = cache.get(cache_key)
    if cached:
        if isinstance(cached, dict):
            return cached["waypoints"], cached["source"]
        return cached, "road"

    anchor_lat = anchor_lat if anchor_lat is not None else lat
    anchor_lon = anchor_lon if anchor_lon is not None else lon
    try:
        route_radius_km = float(
            start_radius_km
            if start_radius_km is not None
            else os.getenv("SCALE_SIM_BROUTER_START_RADIUS_KM", "4")
        )
    except (TypeError, ValueError):
        route_radius_km = 4.0
    route_radius_km = max(0.0, min(route_radius_km, 25.0))

    # BRouter needs a short A→B leg to build a road polyline; full ride distance_m
    # is covered over time along that polyline (not as one giant routing request).
    try:
        max_leg_km = float(os.getenv("SCALE_SIM_BROUTER_MAX_LEG_KM", "4"))
    except (TypeError, ValueError):
        max_leg_km = 4.0
    max_leg_km = max(0.5, min(max_leg_km, 15.0))
    km = min(max(0.5, distance_m / 1000.0), max_leg_km)

    from activities.scale_config import resolve_live_scale_limits

    limits = resolve_live_scale_limits(sim.get_live_state())
    route_attempts = max(1, int(limits["brouter_route_attempts"]))
    for attempt in range(route_attempts):
        if attempt == 0:
            start_lat, start_lon = anchor_lat, anchor_lon
        elif route_radius_km > 0:
            start_lat, start_lon = _jitter_point_km(anchor_lat, anchor_lon, route_radius_km)
        else:
            start_lat, start_lon = anchor_lat, anchor_lon
        cos_lat = math.cos(math.radians(start_lat)) or 1e-6
        bearing = random.uniform(0, 2 * math.pi)
        end_lat = start_lat + (km / 111.0) * math.cos(bearing)
        end_lon = start_lon + (km / (111.0 * cos_lat)) * math.sin(bearing)
        waypoints = _brouter_route_waypoints(
            start_lat,
            start_lon,
            end_lat,
            end_lon,
            activity_type,
            use_tick_budget=use_tick_budget,
        )
        if waypoints:
            payload = {"waypoints": waypoints, "source": "road"}
            cache.set(cache_key, payload, 3600)
            return waypoints, "road"

    if STRICT_ROAD_ROUTES:
        payload = {"waypoints": [], "source": "unroutable"}
        cache.set(cache_key, payload, 120)
        return [], "unroutable"

    grid = _generate_grid_waypoints(lat, lon)
    payload = {"waypoints": grid, "source": "grid"}
    cache.set(cache_key, payload, 3600)
    return grid, "grid"


def _jitter_point_km(lat: float, lon: float, radius_km: float) -> tuple[float, float]:
    """
    Uniform random point inside a circle (radius_km) around (lat, lon).
    Intended for small radii (e.g. 1–25km) to avoid "all riders start at the same dot".
    """
    radius_km = max(0.0, float(radius_km))
    if radius_km <= 0:
        return lat, lon
    # Uniform over area => r = sqrt(U)
    r = radius_km * math.sqrt(random.random())
    theta = random.uniform(0, 2 * math.pi)
    dlat = (r / 111.0) * math.cos(theta)
    cos_lat = math.cos(math.radians(lat)) or 1e-6
    dlon = (r / (111.0 * cos_lat)) * math.sin(theta)
    return lat + dlat, lon + dlon


def _sample_athlete_motion_profile(activity_type: str) -> dict:
    """
    Human-like pace profile:
    - base speed by tier (easy/steady/fast)
    - periodic speed modulation
    - deterministic micro-stops (traffic lights / crossings)
    """
    if activity_type == "BIKE":
        tier = random.choices(
            [("easy", 18.0, 24.0), ("steady", 22.0, 30.0), ("fast", 28.0, 36.0)],
            weights=[0.22, 0.60, 0.18],
            k=1,
        )[0]
        stop_chance = 0.12
    elif activity_type == "RUN":
        tier = random.choices(
            [("easy", 7.0, 9.8), ("steady", 9.0, 12.5), ("fast", 11.0, 15.0)],
            weights=[0.35, 0.50, 0.15],
            k=1,
        )[0]
        stop_chance = 0.08
    else:  # WALK / other
        tier = random.choices(
            [("easy", 3.8, 5.3), ("steady", 4.5, 6.2), ("fast", 5.6, 7.2)],
            weights=[0.45, 0.45, 0.10],
            k=1,
        )[0]
        stop_chance = 0.06

    _label, low, high = tier
    base_speed = random.uniform(low, high)
    return {
        "speed_kmh": base_speed,
        "speed_variation": random.uniform(0.06, 0.18),
        "phase_offset": random.uniform(0, 2 * math.pi),
        "stop_cycle_s": random.randint(180, 520),
        "stop_duration_s": random.randint(8, 35) if random.random() < stop_chance else 0,
        "start_delay_s": random.randint(0, 90),
    }


def _compute_live_motion(ride: dict, now_dt, start_dt, end_dt) -> tuple[float, float, float]:
    """
    Returns (progress[0..1], speed_kmh, paused_seconds) with deterministic pause windows.
    """
    total_s = max(1.0, (end_dt - start_dt).total_seconds())
    elapsed_raw = (now_dt - start_dt).total_seconds()
    if elapsed_raw <= 0:
        return 0.0, 0.0, 0.0

    stop_cycle = max(1, int(ride.get("stop_cycle_s", 300) or 300))
    stop_dur = max(0, int(ride.get("stop_duration_s", 0) or 0))
    stop_dur = min(stop_dur, max(0, stop_cycle - 5))
    if stop_dur > 0:
        cycles = int(elapsed_raw // stop_cycle)
        rem = elapsed_raw % stop_cycle
        paused = cycles * stop_dur + max(0.0, rem - (stop_cycle - stop_dur))
        in_stop = rem > (stop_cycle - stop_dur)
    else:
        paused = 0.0
        in_stop = False

    effective_elapsed = max(0.0, elapsed_raw - paused)
    progress = max(0.0, min(1.0, effective_elapsed / total_s))

    base = float(ride.get("speed_kmh", 0) or 0)
    variation = float(ride.get("speed_variation", 0.1) or 0.1)
    phase = float(ride.get("phase_offset", 0.0) or 0.0)
    # Smooth effort wave over time (fatigue / terrain / cadence changes).
    wave = math.sin((effective_elapsed / 140.0) + phase) * variation
    speed_kmh = max(0.0, base * (1.0 + wave))
    if in_stop:
        speed_kmh = 0.0
    return progress, speed_kmh, paused


def _generate_road_waypoints(
    lat: float, lon: float, distance_m: float, activity_type: str
) -> list[tuple[float, float]]:
    """Backward-compatible wrapper — returns waypoints only."""
    waypoints, _ = _generate_route_waypoints(lat, lon, distance_m, activity_type)
    return waypoints


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
        use_tick_budget=False,
    )
    current = sim.get_live_rides().get(user_id) or ride
    if ride_fsm.normalize_ride_state(current) != ride_fsm.ROUTING:
        return
    if waypoints and len(waypoints) >= 2 and route_source != "unroutable":
        start_lat, start_lon = waypoints[0][0], waypoints[0][1]
        sim.set_live_ride(
            user_id,
            {
                **current,
                "ride_state": ride_fsm.ROUTED,
                "waypoints": waypoints,
                "route_source": route_source,
                "lat": start_lat,
                "lon": start_lon,
            },
        )
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
    max_retries=2,
    autoretry_for=(WorkerLostError,),
    retry_backoff=True,
    retry_jitter=True,
)
def route_live_ride_task(self, user_id: int):
    """Pre-compute road polyline off the live tick (queue: routing)."""
    if not sim.get_live_state().get("running"):
        sim.delete_live_ride(user_id)
        return
    rides = sim.get_live_rides()
    ride = rides.get(user_id)
    if not ride or not ride_fsm.can_dispatch_routing(ride):
        return
    sim.set_live_ride(user_id, {**ride, "ride_state": ride_fsm.ROUTING})
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
        _run_live_tick_body()
    finally:
        sim.set_live_state(last_tick_at=time.time())
        sim.release_live_tick_lock()


def _run_live_tick_body():
    """Core tick logic — separated so lock handling stays in the task wrapper."""
    from users.models import User
    from activities.models import Activity
    from activities.services import TelemetryService
    from activities.scale_disk_monitor import check_sim_writes_allowed
    from simulate_active_cities import (
        CITIES,
        _pick_activity_type,
        _generate_activity_params,
        resolve_city_for_user,
    )

    state = sim.get_live_state()
    if not state.get("running", False):
        return

    if sim.batch_blocks_live_simulation()[0]:
        return

    _heal_stale_batch_running_flag()

    writes_ok, write_reason = check_sim_writes_allowed("simulator")
    if not writes_ok:
        sim.live_log(f"Disk guard (writes): {write_reason}")
        return

    now = timezone.now()
    from activities.scale_config import MAX_TELEMETRY_PUBLISH_PER_TICK, resolve_live_scale_limits
    from events.burst import effective_event_concurrent_cap, max_starts_per_live_tick

    scale_limits = resolve_live_scale_limits(state)
    pool_size = sim.get_live_pool_count()
    active_rides = sim.get_live_rides()

    cheat_ratio = float(state.get("cheat_ratio", 0.05))
    active_ratio = float(state.get("active_ratio", 0.25))
    total_users = int(state.get("total_users", 100))

    activities_to_create = []
    completed = 0
    cheaters = 0

    async_routing = _async_routing_enabled()

    # Promote pre-routed rides to ACTIVE when start_time reached
    for user_id, ride in list(active_rides.items()):
        if ride_fsm.can_promote_to_active(ride, now):
            sim.set_live_ride(user_id, {**ride, "ride_state": ride_fsm.ACTIVE})

    active_rides = sim.get_live_rides()

    # ── Phase 1: Finish expired ACTIVE rides ──
    rides_to_remove = []
    for user_id, ride in active_rides.items():
        if ride_fsm.normalize_ride_state(ride) != ride_fsm.ACTIVE:
            continue
        end_time = ride.get("end_time")
        if isinstance(end_time, str):
            end_time = timezone.datetime.fromisoformat(end_time)
        if end_time and now >= end_time:
            rides_to_remove.append(user_id)

    users_map_p2 = {}
    if rides_to_remove:
        users_map_p2 = {
            str(u.id): u
            for u in User.objects.filter(id__in=rides_to_remove).select_related("tenant")
        }

    for user_id in rides_to_remove:
        user = users_map_p2.get(str(user_id))
        if not user:
            continue
        ride = active_rides[user_id]

        distance_m = ride.get("distance_m", 5000)
        act_type = ride.get("act_type", "RUN")
        is_cheater = ride.get("is_cheater", False)
        start_time = ride.get("start_time")
        if isinstance(start_time, str):
            start_time = timezone.datetime.fromisoformat(start_time)

        lat = ride.get("lat", 52.2297)
        lon = ride.get("lon", 21.0122)

        if is_cheater:
            from django.contrib.gis.geos import LineString

            n_points = 8
            coords = [
                (
                    lon + distance_m / 100000.0 * (i / n_points),
                    lat + distance_m / 100000.0 * (i / n_points),
                )
                for i in range(n_points)
            ]
            route = LineString(coords, srid=4326)
            is_verified = False
            score = random.uniform(0.0, 0.25)
            cheaters += 1
        else:
            try:
                from django.contrib.gis.geos import LineString

                waypoints = ride.get("waypoints") or []
                if isinstance(waypoints, list) and len(waypoints) >= 2:
                    # Reuse live route polyline so saved activities follow roads too.
                    route = LineString([(p[1], p[0]) for p in waypoints], srid=4326)
                else:
                    from simulate_active_cities import _generate_gps_track

                    route = _generate_gps_track(lat, lon, distance_m, act_type)
            except Exception:
                route = None
            is_verified = random.random() < 0.92
            score = random.uniform(0.7, 1.0) if is_verified else random.uniform(0.0, 0.4)

        duration_s = max(60, int((now - start_time).total_seconds())) if start_time else 1800
        activities_to_create.append(
            Activity(
                user=user,
                tenant=user.tenant,
                type=act_type,
                start_time=start_time or now,
                end_time=now,
                distance=distance_m,
                duration=timedelta(seconds=duration_s),
                is_verified=is_verified,
                verification_score=score,
                route_path=route,
            )
        )
        completed += 1

    if activities_to_create:
        try:
            Activity.objects.bulk_create(activities_to_create, batch_size=50)
        except Exception:
            for a in activities_to_create:
                try:
                    a.save()
                except Exception:
                    pass

    for uid in rides_to_remove:
        sim.delete_live_ride(uid)

    # ── Phase 2: Start new rides (capped globally + balanced per city) ──
    max_riders = effective_event_concurrent_cap(state)
    tick_seconds = int(state.get("tick_seconds", 8))
    current_riding = sim.get_live_ride_count()
    target_riding = min(
        max_riders,
        max(1, int(total_users * active_ratio)),
    )
    needed = max(0, target_riding - current_riding)
    event_stagger_cap = None
    if state.get("event_id") or state.get("event_load_test"):
        event_stagger_cap = max_starts_per_live_tick(total_users, active_ratio, tick_seconds)
    global_start_cap = int(scale_limits["max_starts_per_live_tick"] or 0)
    if event_stagger_cap is not None:
        needed = min(needed, event_stagger_cap)
    if global_start_cap > 0:
        needed = min(needed, global_start_cap)
    started = 0

    db_pool = sim.is_live_pool_db_mode()
    if needed > 0 and (pool_size > 0 or db_pool):
        riding_ids = {str(uid) for uid in active_rides.keys()}
        riding_by_city: dict[str, int] = {}
        for ride in active_rides.values():
            ride_state = ride_fsm.normalize_ride_state(ride)
            if ride_state not in (
                ride_fsm.ACTIVE,
                ride_fsm.ROUTED,
                ride_fsm.ROUTING,
                ride_fsm.PENDING_ROUTE,
            ):
                continue
            slug = ride.get("city_slug")
            if slug:
                riding_by_city[slug] = riding_by_city.get(slug, 0) + 1

        n_cities = len(CITIES)
        base_per_city = target_riding // max(1, n_cities)
        extra_slots = target_riding % max(1, n_cities)

        # When `needed` is throttled (event stagger / load-test), iterating CITIES in a fixed
        # order biases the first cities (they reach the per-city cap while others stay at 0).
        # Randomize caps + iteration order per tick to keep the overview badges balanced.
        caps: dict[str, int] = {c["slug"]: base_per_city for c in CITIES}
        if extra_slots > 0 and n_cities > 0:
            extra_slugs = random.sample([c["slug"] for c in CITIES], k=min(extra_slots, n_cities))
            for s in extra_slugs:
                caps[s] = caps.get(s, base_per_city) + 1

        starters: list = []
        cities = list(CITIES)
        random.shuffle(cities)
        for city in cities:
            slug = city["slug"]
            city_cap = int(caps.get(slug, base_per_city))
            city_needed = max(0, city_cap - int(riding_by_city.get(slug, 0)))
            if city_needed <= 0 or len(starters) >= needed:
                continue
            city_needed = min(city_needed, needed - len(starters))
            sample_size = min(city_needed * 4, 10_000)
            if db_pool:
                candidates = sim.sample_live_athletes_from_db(slug, sample_size)
            else:
                candidates = sim.sample_live_pool_city(slug, sample_size)
                if len(candidates) < city_needed:
                    candidates = list(
                        dict.fromkeys(
                            candidates + sim.sample_live_pool(min(sample_size, pool_size))
                        )
                    )
            available = [uid for uid in candidates if str(uid) not in riding_ids]
            pick = random.sample(available, min(city_needed, len(available))) if available else []
            for uid in pick:
                riding_ids.add(str(uid))
            starters.extend(pick)

        users_map_p3 = {}
        if starters:
            users_map_p3 = {
                str(u.id): u for u in User.objects.filter(id__in=starters).select_related("tenant")
            }

        routing_dispatched = 0
        routing_dispatch_cap = (
            routing_bp.max_routing_dispatch_per_tick(scale_limits) if async_routing else 0
        )
        active_rides_pre = sim.get_live_rides()
        fsm_pre = ride_fsm.fsm_summary(active_rides_pre)
        bp_snapshot = routing_bp.routing_backpressure_snapshot(
            fsm_pending=fsm_pre["ride_warming"],
        )
        routing_dispatch_cap, dispatch_throttled = routing_bp.effective_routing_dispatch_cap(
            routing_dispatch_cap,
            bp_snapshot,
            starters_remaining=len(starters),
        )
        dispatches_skipped = 0
        unroutable = 0
        for user_id in starters:
            user = users_map_p3.get(str(user_id))
            if not user:
                continue

            act_type = _pick_activity_type()
            distance_m, duration_s = _generate_activity_params(act_type)
            duration_s = max(300, min(3600, duration_s))
            is_cheater = random.random() < cheat_ratio

            city_info = resolve_city_for_user(user)
            lat0, lon0 = city_info["lat"], city_info["lon"]
            try:
                start_radius_km = float(os.getenv("SCALE_SIM_CITY_START_RADIUS_KM", "4"))
            except (TypeError, ValueError):
                start_radius_km = 4.0
            start_radius_km = max(0.0, min(start_radius_km, 25.0))

            motion = _sample_athlete_motion_profile(act_type)
            start_delay_s = int(motion.get("start_delay_s", 0) or 0)
            ride_start = now + timedelta(seconds=start_delay_s)
            ride_end = ride_start + timedelta(seconds=duration_s)

            ride_payload = {
                "start_time": ride_start.isoformat(),
                "end_time": ride_end.isoformat(),
                "act_type": act_type,
                "distance_m": distance_m,
                "lat": lat0,
                "lon": lon0,
                "anchor_lat": lat0,
                "anchor_lon": lon0,
                "start_radius_km": start_radius_km,
                "city_slug": city_info["slug"],
                "is_cheater": is_cheater,
                **motion,
            }

            if async_routing and routing_dispatched < routing_dispatch_cap:
                sim.set_live_ride(
                    user_id,
                    {
                        **ride_payload,
                        "ride_state": ride_fsm.PENDING_ROUTE,
                    },
                )
                route_live_ride_task.delay(user_id)
                routing_dispatched += 1
                started += 1
                continue

            if async_routing and dispatch_throttled:
                dispatches_skipped += 1
                continue

            waypoints, route_source = _generate_route_waypoints(
                lat0,
                lon0,
                distance_m,
                act_type,
                anchor_lat=lat0,
                anchor_lon=lon0,
                start_radius_km=start_radius_km,
            )
            if not waypoints or len(waypoints) < 2:
                unroutable += 1
                sim.increment_live_routing_counter("routing_unroutable_total")
                continue
            if route_source == "grid":
                _maybe_log_brouter_grid_fallback()
            start_lat, start_lon = waypoints[0][0], waypoints[0][1]
            initial_state = ride_fsm.ROUTED if async_routing else ride_fsm.ACTIVE
            if async_routing and ride_start <= now:
                initial_state = ride_fsm.ACTIVE

            sim.set_live_ride(
                user_id,
                {
                    **ride_payload,
                    "ride_state": initial_state,
                    "waypoints": waypoints,
                    "route_source": route_source,
                    "lat": start_lat,
                    "lon": start_lon,
                },
            )
            started += 1
        if unroutable > 0 and STRICT_ROAD_ROUTES:
            sim.live_log(
                f"Road-only mode: skipped {unroutable} starts this tick "
                f"(no routable street path; see BRouter routing failed lines above)."
            )
        if async_routing and routing_dispatched > 0:
            sim.live_log(f"Queued {routing_dispatched} rides on routing worker.")
        if async_routing and dispatches_skipped > 0:
            routing_bp.maybe_log_routing_backpressure(
                snapshot=bp_snapshot,
                skipped=dispatches_skipped,
                base_cap=routing_bp.max_routing_dispatch_per_tick(scale_limits),
            )
        if async_routing:
            sim.set_live_state(
                routing_queue_depth=bp_snapshot["routing_queue_depth"],
                routing_backpressure_active=bp_snapshot["routing_backpressure_active"],
                dispatches_throttled=dispatches_skipped > 0 or dispatch_throttled,
                dispatches_throttled_last_tick=dispatches_skipped,
            )

    # ── Phase 3: Interpolate + push telemetry for ALL active riders ──
    active_rides = sim.get_live_rides()
    telemetry_entries = []

    for user_id, ride in active_rides.items():
        if not ride_fsm.telemetry_eligible(ride):
            continue
        start_time = ride.get("start_time")
        end_time = ride.get("end_time")
        if isinstance(start_time, str):
            start_time = timezone.datetime.fromisoformat(start_time)
        if isinstance(end_time, str):
            end_time = timezone.datetime.fromisoformat(end_time)

        if start_time and end_time:
            progress, speed_kmh, _paused_s = _compute_live_motion(ride, now, start_time, end_time)
        else:
            total_s = (end_time - start_time).total_seconds() if start_time and end_time else 1800
            elapsed_s = (now - start_time).total_seconds() if start_time else 0
            progress = max(0, min(1, elapsed_s / total_s if total_s > 0 else 0))
            speed_kmh = ride.get("speed_kmh")
            if not isinstance(speed_kmh, (int, float)):
                speed_kmh = (
                    random.uniform(12, 35)
                    if ride.get("act_type") == "BIKE"
                    else random.uniform(6, 15)
                )

        waypoints = ride.get("waypoints")
        if waypoints and len(waypoints) >= 2:
            clat, clon, course = _interpolate_along_polyline(waypoints, progress)
        else:
            clat = ride.get("lat", 52.2297)
            clon = ride.get("lon", 21.0122)
            course = 0

        telemetry_entries.append(
            {
                "deviceId": str(user_id),
                "name": f"Athlete {user_id}",
                "type": ride.get("act_type", "BIKE"),
                "lat": clat,
                "lng": clon,
                "speed": speed_kmh / 3.6,
                "course": course,
            }
        )

    if len(telemetry_entries) > MAX_TELEMETRY_PUBLISH_PER_TICK:
        telemetry_entries = telemetry_entries[:MAX_TELEMETRY_PUBLISH_PER_TICK]
    TelemetryService.push_bulk_positions(telemetry_entries)

    active_rides = sim.get_live_rides()
    fsm = ride_fsm.fsm_summary(active_rides)
    sim.set_live_state(
        currently_riding=fsm["ride_on_map"],
        total_completed=int(state.get("total_completed", 0)) + completed,
        cheaters_caught=int(state.get("cheaters_caught", 0)) + cheaters,
    )
    new_riding = fsm["ride_on_map"]

    if started > 0 or completed > 0:
        ctx = []
        if started > 0:
            ctx.append(f"{started} started")
        if completed > 0:
            ctx.append(f"{completed} completed")
            if cheaters > 0:
                ctx.append(f"{cheaters} cheater{'s' if cheaters > 1 else ''}")
        sim.live_log(
            f"Tick: {', '.join(ctx)} — {new_riding} riding, 📡 {len(telemetry_entries)} positions"
        )
