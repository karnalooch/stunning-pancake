"""
Simulator road routing helpers — waypoint generation, BRouter tick budget, polyline math.

Extracted from simulator_tasks.py (Q-P0-3). Celery task names stay in simulator_tasks.
"""

import logging
import math
import os
import random
import time

from django.core.cache import cache

from . import simulator_state as sim
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
            "(set BROUTER_URL or BROUTER_URLS on celery-worker-simulation)"
        )
        return
    now = time.time()
    if now - _brouter_grid_log_last_hour < 3600:
        return
    _brouter_grid_log_last_hour = now
    sim.live_log(
        "BRouter unavailable — grid fallback (throttled; configure BROUTER_URL/BROUTER_URLS on simulation worker)"
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
                f"{BRouterService.endpoints_display()} -> island/unroutable (section 0, pass=0): {last_err}",
                unroutable=True,
            )
        else:
            _maybe_log_brouter_route_failure(
                f"{BRouterService.endpoints_display()} -> {last_err}",
            )
    except Exception as exc:
        _maybe_log_brouter_route_failure(
            f"{BRouterService.endpoints_display()} exception: {exc}",
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
    city_slug: str | None = None,
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

    if city_slug:
        from activities.sim_route_cache import apply_route_template, get_route_template

        tpl = get_route_template(
            city_slug=city_slug,
            activity_type=activity_type,
            distance_m=distance_m,
        )
        if tpl:
            shifted = apply_route_template(
                tpl, anchor_lat=anchor_lat, anchor_lon=anchor_lon
            )
            if len(shifted) >= 2:
                payload = {"waypoints": shifted, "source": tpl.get("source", "road")}
                cache.set(cache_key, payload, 3600)
                return shifted, str(tpl.get("source", "road"))
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
    for _attempt in range(route_attempts):
        if route_radius_km > 0:
            start_lat, start_lon = _jitter_point_km(anchor_lat, anchor_lon, route_radius_km)
        else:
            start_lat, start_lon = anchor_lat, anchor_lon
        cos_lat = math.cos(math.radians(start_lat)) or 1e-6
        bearing = random.uniform(0, 2 * math.pi)
        end_lat = start_lat + (km / 111.0) * math.cos(bearing)
        end_lon = start_lon + (km / (111.0 * cos_lat)) * math.sin(bearing)
        from activities.sim_routing import road_route_waypoints

        waypoints = road_route_waypoints(
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
            if city_slug:
                from activities.sim_route_cache import set_route_template

                set_route_template(
                    city_slug=city_slug,
                    activity_type=activity_type,
                    distance_m=distance_m,
                    anchor_lat=anchor_lat,
                    anchor_lon=anchor_lon,
                    waypoints=waypoints,
                    source="road",
                )
            return waypoints, "road"

    if STRICT_ROAD_ROUTES:
        # Do not negative-cache at city granularity — one island miss would block all riders.
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


def _instant_active_on_route_enabled() -> bool:
    return os.getenv("SCALE_SIM_INSTANT_ACTIVE_ON_ROUTE", "1").lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _ramp_start_delay_max(state: dict) -> int | None:
    """
    Shorter random start_delay during early live ticks so ROUTED rides reach ACTIVE sooner.
    Unset SCALE_SIM_RAMP_START_DELAY_MAX or SCALE_SIM_RAMP_TICKS=0 disables the ramp window.
    """
    raw_max = os.getenv("SCALE_SIM_RAMP_START_DELAY_MAX", "20").strip()
    if not raw_max:
        return None
    try:
        delay_max = int(raw_max)
    except (TypeError, ValueError):
        return None
    if delay_max < 0:
        return None
    try:
        ramp_ticks = int(os.getenv("SCALE_SIM_RAMP_TICKS", "12"))
    except (TypeError, ValueError):
        ramp_ticks = 12
    if ramp_ticks <= 0:
        return None
    started = state.get("started_at")
    if started is None:
        return delay_max
    try:
        elapsed = time.time() - float(started)
    except (TypeError, ValueError):
        return delay_max
    try:
        tick_s = max(1, int(state.get("tick_seconds") or 8))
    except (TypeError, ValueError):
        tick_s = 8
    if elapsed < ramp_ticks * tick_s:
        return delay_max
    return None


def _sample_athlete_motion_profile(
    activity_type: str,
    *,
    start_delay_max: int | None = None,
) -> dict:
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
        "start_delay_s": random.randint(
            0,
            min(90, start_delay_max) if start_delay_max is not None else 90,
        ),
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

