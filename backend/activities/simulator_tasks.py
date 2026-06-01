"""
Celery Tasks for Simulator
============================
Background tasks that run the simulation logic with real-time telemetry.
"""
import math
import random
import time
from datetime import timedelta

from celery import shared_task
from django.utils import timezone
from django.core.cache import cache

from . import simulator_state as sim
from .services import BRouterService

_EARTH_RADIUS_M = 6_371_000.0

_brouter_grid_log_count = 0
_brouter_grid_log_last_hour = 0.0


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
    waypoints: list[tuple[float, float]], progress: float,
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

def _brouter_route_waypoints(
    start_lat: float, start_lon: float, end_lat: float, end_lon: float, activity_type: str,
) -> list[tuple[float, float]] | None:
    """Request a road-following polyline; first point is snapped onto the network."""
    try:
        result = BRouterService.validate_track(activity_type, [
            [start_lon, start_lat],
            [end_lon, end_lat],
        ])
        if result.get('success') and result.get('raw_data'):
            features = result['raw_data'].get('features', [])
            if features:
                coords = features[0]['geometry']['coordinates']
                waypoints = [(c[1], c[0]) for c in coords]
                if len(waypoints) >= 2:
                    return waypoints
    except Exception:
        pass
    return None


def _skip_brouter_now() -> bool:
    """During batch-only runs, avoid BRouter HTTP (set SCALE_SIM_SKIP_BROUTER=1 or batch running)."""
    import os
    if os.getenv('SCALE_SIM_SKIP_BROUTER', '').lower() in ('1', 'true', 'yes', 'on'):
        return True
    try:
        return bool(sim.get_batch_state().get('running'))
    except Exception:
        return False


# ── Road-following waypoint generator (uses BRouter for real road routes) ──
def _generate_route_waypoints(
    lat: float, lon: float, distance_m: float, activity_type: str,
) -> tuple[list[tuple[float, float]], str]:
    """
    Prefer BRouter road polyline from city center; grid fallback if unavailable.
    Returns (waypoints, source) where source is 'road' or 'grid'.
    Cached per (lat, lon, distance, type) for 1 hour.
    """
    if _skip_brouter_now():
        grid = _generate_grid_waypoints(lat, lon)
        return grid, 'grid'

    cache_key = f"road_wp:{lat:.4f}:{lon:.4f}:{int(distance_m)}:{activity_type}"
    cached = cache.get(cache_key)
    if cached:
        if isinstance(cached, dict):
            return cached['waypoints'], cached['source']
        return cached, 'road'

    cos_lat = math.cos(math.radians(lat))
    km = max(0.5, distance_m / 1000.0)

    for _ in range(3):
        bearing = random.uniform(0, 2 * math.pi)
        end_lat = lat + (km / 111.0) * math.cos(bearing)
        end_lon = lon + (km / (111.0 * cos_lat)) * math.sin(bearing)
        waypoints = _brouter_route_waypoints(lat, lon, end_lat, end_lon, activity_type)
        if waypoints:
            payload = {'waypoints': waypoints, 'source': 'road'}
            cache.set(cache_key, payload, 3600)
            return waypoints, 'road'

    grid = _generate_grid_waypoints(lat, lon)
    payload = {'waypoints': grid, 'source': 'grid'}
    cache.set(cache_key, payload, 3600)
    return grid, 'grid'


def _generate_road_waypoints(lat: float, lon: float, distance_m: float, activity_type: str) -> list[tuple[float, float]]:
    """Backward-compatible wrapper — returns waypoints only."""
    waypoints, _ = _generate_route_waypoints(lat, lon, distance_m, activity_type)
    return waypoints


@shared_task(bind=True, queue='simulation', max_retries=0)
def run_batch_city_users(self, city_slug, users_per_city, scale, city_index, total_cities, total_target_users):
    """Create users for one city (parallel batch phase)."""
    from simulate_active_cities import create_users_for_city

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


@shared_task(bind=True, queue='simulation', max_retries=0)
def run_batch_finalize(self, city_results, skip_activities=False):
    """Chord callback after parallel city user creation."""
    from users.models import User
    from activities.models import Activity

    try:
        city_total = sum(int(x or 0) for x in (city_results or []))
        sim.batch_log(f"Parallel cities done: {city_total} users in workers")

        user_count = User.objects.filter(role='ATHLETE').count()
        activity_count = Activity.objects.count()

        sim.set_batch_state(
            current_phase='complete', progress_pct=100,
            users_created=user_count, activities_created=activity_count,
            running=False, completed_at=time.time(),
        )
        sim.batch_log(f"Done: {user_count} users, {activity_count} activities")
        from activities.admin_stats import invalidate_dashboard_stats_cache
        invalidate_dashboard_stats_cache()
        return {'status': 'complete', 'users': user_count, 'activities': activity_count}
    except Exception as e:
        sim.set_batch_state(error=str(e), running=False, completed_at=time.time())
        sim.batch_log(f"ERROR finalize: {e}")
        return {'status': 'error', 'error': str(e)}
    finally:
        sim.release_batch_lock()


@shared_task(bind=True, queue='simulation', max_retries=0)
def run_batch_simulation(self, scale=0.01, days=30, clear=False,
                          skip_activities=False, total_users=None):
    """Generate tenants, departments, users, and activities."""
    from simulate_active_cities import run
    from users.models import User
    from activities.scale_config import compute_batch_scaling

    if not sim.acquire_batch_lock():
        sim.batch_log("ERROR: batch lock — another simulation running")
        sim.set_batch_state(error='Another simulation is running', running=False)
        return {'status': 'locked'}

    target = int(total_users or 0)
    batch_plan = compute_batch_scaling(target) if target else {}

    if target >= 1_000:
        from activities.scale_disk_guard import prepare_batch_disk_guard

        sim.set_batch_state(current_phase='disk_guard', progress_pct=1)
        sim.batch_log('Sprawdzanie miejsca na dysku Postgres…')
        guard = prepare_batch_disk_guard(
            target, skip_activities=skip_activities, clear=clear,
        )
        for action in guard.get('actions') or []:
            sim.batch_log(action)
        if not guard.get('ok'):
            err = guard.get('error', 'Disk guard blocked batch')
            sim.set_batch_state(error=err, running=False, completed_at=time.time())
            sim.batch_log(f'ERROR disk guard: {err}')
            sim.release_batch_lock()
            return {'status': 'disk_guard', 'error': err}
        batch_plan = guard.get('batch_plan') or batch_plan
        sim.set_batch_state(
            user_bulk_pg_batch_size=batch_plan.get('user_bulk_pg_batch_size'),
            user_bulk_batch_size=batch_plan.get('user_bulk_batch_size'),
            max_parallel_workers=batch_plan.get('max_parallel_workers'),
            disk_usage_ratio=guard.get('disk_usage_ratio'),
            db_size_gb=guard.get('db_size_gb'),
        )

    use_parallel = bool(
        skip_activities
        and target
        and batch_plan.get('use_parallel_cities')
    )
    parallel_started = False

    try:
        sim.reset_batch_state()
        sim.set_batch_state(
            running=True, started_at=time.time(), scale=scale, days=days,
            total_users=target, current_phase='initializing', progress_pct=0,
            users_created=0,
        )
        if batch_plan:
            eta_min = max(1, batch_plan['estimated_batch_seconds'] // 60)
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
            phase = kwargs.get('current_phase', '')
            if phase and phase != last_logged_phase[0]:
                last_logged_phase[0] = phase
                sim.batch_log(f"Phase: {phase}")
            sim.set_batch_state(**{k: v for k, v in kwargs.items() if v is not None})

        sim.set_batch_state(current_phase='generating', progress_pct=2, total_users=target)

        if use_parallel:
            from celery import chord, group

            plan = run(
                scale=scale, days=days, clear=clear, dry_run=False,
                skip_activities=True, skip_user_creation=True,
                total_users=total_users, progress_callback=on_progress,
            )
            slugs = plan['city_slugs']
            users_per_city = plan['users_per_city']
            plan_scale = plan['scale']
            total_u = plan['total_u']
            sim.batch_log(
                f"Parallel user creation: {len(slugs)} cities × {users_per_city} users"
            )
            sim.set_batch_state(current_phase='creating_users', progress_pct=22)

            header = group(
                run_batch_city_users.s(
                    slug, users_per_city, plan_scale, idx, len(slugs), total_u,
                )
                for idx, slug in enumerate(slugs)
            )
            chord(header)(run_batch_finalize.s(skip_activities=skip_activities))
            parallel_started = True
            return {'status': 'parallel_started', 'cities': len(slugs)}

        run(
            scale=scale, days=days, clear=clear, dry_run=False,
            skip_activities=skip_activities, total_users=total_users,
            progress_callback=on_progress,
        )

        user_count = User.objects.filter(role='ATHLETE').count()
        from activities.models import Activity
        activity_count = Activity.objects.count()

        sim.set_batch_state(
            current_phase='complete', progress_pct=100,
            users_created=user_count, activities_created=activity_count,
            running=False, completed_at=time.time(),
        )
        sim.batch_log(f"Done: {user_count} users, {activity_count} activities")
        from activities.admin_stats import invalidate_dashboard_stats_cache
        invalidate_dashboard_stats_cache()
        return {'status': 'complete', 'users': user_count, 'activities': activity_count}

    except Exception as e:
        sim.set_batch_state(error=str(e), running=False, completed_at=time.time())
        sim.batch_log(f"ERROR: {e}")
        return {'status': 'error', 'error': str(e)}
    finally:
        if not parallel_started:
            sim.release_batch_lock()


@shared_task(bind=True, queue='simulation', max_retries=0)
def run_live_simulation(self, total_users=100, active_ratio=0.25,
                         cheat_ratio=0.05, tick_seconds=10):
    """Orchestrator — non-blocking tick chain. Each invocation runs one tick and schedules the next."""
    from users.models import User

    state = sim.get_live_state()

    # Stopped / aborted — drain chained Celery tasks without re-acquiring the lock
    if not state.get('running'):
        sim.release_live_lock()
        return {'status': 'stopped'}

    tick_seconds = int(state.get('tick_seconds') or tick_seconds)
    active_ratio = float(state.get('active_ratio') or active_ratio)
    cheat_ratio = float(state.get('cheat_ratio') or cheat_ratio)
    pool_target = int(state.get('total_users') or total_users)

    # One-time pool setup (POST already set running=True and holds the lock)
    if not sim.is_live_pool_db_mode() and sim.get_live_pool_count() == 0:
        from activities.scale_config import compute_batch_scaling

        pool_plan = compute_batch_scaling(max(pool_target, 1))
        if pool_plan['live_pool_mode'] == 'db':
            pool_size = sim.init_live_pool_db_mode(pool_target)
            mode_note = "db sampling per city"
        else:
            pool_limit = pool_plan['live_pool_redis_cap']
            pool_size = sim.set_live_pool_from_db(pool_limit)
            mode_note = f"redis pool (cap {pool_limit})"
        sim.set_live_state(total_users=pool_size)
        if pool_size < pool_target:
            sim.live_log(f"WARNING: only {pool_size} athletes available (wanted {pool_target})")
        sim.live_log(
            f"LIVE SIM: {mode_note}, n={pool_size}, {active_ratio*100:.0f}% active (capped), "
            f"{cheat_ratio*100:.0f}% cheaters, tick={tick_seconds}s"
        )

    if not sim.get_live_state().get('running', False):
        sim.release_live_lock()
        return {'status': 'stopped'}

    try:
        live_tick_task.delay()
        sim.refresh_live_lock()
    except Exception as e:
        sim.live_log(f"Tick error: {e}")

    sim.set_live_state(last_tick_at=time.time())

    if not sim.get_live_state().get('running', False):
        sim.release_live_lock()
        return {'status': 'stopped'}

    self.apply_async(countdown=tick_seconds)
    return {'status': 'tick_complete', 'next_tick_in': tick_seconds}


@shared_task(bind=True, queue='simulation', max_retries=0)
def live_tick_task(self):
    """One tick: finish rides, start new ones, push telemetry to Redis."""
    if not sim.acquire_live_tick_lock():
        return

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
    from simulate_active_cities import CITIES, _pick_activity_type, _generate_activity_params, resolve_city_for_user

    state = sim.get_live_state()
    if not state.get('running', False):
        return

    now = timezone.now()
    from activities.scale_config import MAX_TELEMETRY_PUBLISH_PER_TICK
    from events.burst import effective_event_concurrent_cap, max_starts_per_live_tick

    pool_size = sim.get_live_pool_count()
    active_rides = sim.get_live_rides()

    cheat_ratio = float(state.get('cheat_ratio', 0.05))
    active_ratio = float(state.get('active_ratio', 0.25))
    total_users = int(state.get('total_users', 100))

    activities_to_create = []
    completed = 0
    cheaters = 0

    # ── Phase 1: Finish expired rides ──
    rides_to_remove = []
    for user_id, ride in active_rides.items():
        end_time = ride.get('end_time')
        if isinstance(end_time, str):
            end_time = timezone.datetime.fromisoformat(end_time)
        if end_time and now >= end_time:
            rides_to_remove.append(user_id)

    users_map_p2 = {}
    if rides_to_remove:
        users_map_p2 = {str(u.id): u for u in User.objects.filter(id__in=rides_to_remove).select_related('tenant')}

    for user_id in rides_to_remove:
        user = users_map_p2.get(str(user_id))
        if not user:
            continue
        ride = active_rides[user_id]

        distance_m = ride.get('distance_m', 5000)
        act_type = ride.get('act_type', 'RUN')
        is_cheater = ride.get('is_cheater', False)
        start_time = ride.get('start_time')
        if isinstance(start_time, str):
            start_time = timezone.datetime.fromisoformat(start_time)

        lat = ride.get('lat', 52.2297)
        lon = ride.get('lon', 21.0122)

        if is_cheater:
            from django.contrib.gis.geos import LineString
            n_points = 8
            coords = [
                (lon + distance_m / 100000.0 * (i / n_points),
                 lat + distance_m / 100000.0 * (i / n_points))
                for i in range(n_points)
            ]
            route = LineString(coords, srid=4326)
            is_verified = False
            score = random.uniform(0.0, 0.25)
            cheaters += 1
        else:
            try:
                from simulate_active_cities import _generate_gps_track
                route = _generate_gps_track(lat, lon, distance_m, act_type)
            except Exception:
                route = None
            is_verified = random.random() < 0.92
            score = random.uniform(0.7, 1.0) if is_verified else random.uniform(0.0, 0.4)

        duration_s = max(60, int((now - start_time).total_seconds())) if start_time else 1800
        activities_to_create.append(Activity(
            user=user, tenant=user.tenant, type=act_type,
            start_time=start_time or now, end_time=now,
            distance=distance_m, duration=timedelta(seconds=duration_s),
            is_verified=is_verified, verification_score=score,
            route_path=route,
        ))
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
    tick_seconds = int(state.get('tick_seconds', 8))
    current_riding = sim.get_live_ride_count()
    target_riding = min(
        max_riders,
        max(1, int(total_users * active_ratio)),
    )
    needed = max(0, target_riding - current_riding)
    if state.get('event_id') or state.get('event_load_test'):
        needed = min(needed, max_starts_per_live_tick(total_users, active_ratio, tick_seconds))
    started = 0

    db_pool = sim.is_live_pool_db_mode()
    if needed > 0 and (pool_size > 0 or db_pool):
        riding_ids = {str(uid) for uid in active_rides.keys()}
        riding_by_city: dict[str, int] = {}
        for ride in active_rides.values():
            slug = ride.get('city_slug')
            if slug:
                riding_by_city[slug] = riding_by_city.get(slug, 0) + 1

        n_cities = len(CITIES)
        base_per_city = target_riding // n_cities
        extra_slots = target_riding % n_cities

        starters: list = []
        for idx, city in enumerate(CITIES):
            slug = city['slug']
            city_cap = base_per_city + (1 if idx < extra_slots else 0)
            city_needed = max(0, city_cap - riding_by_city.get(slug, 0))
            if city_needed <= 0 or len(starters) >= needed:
                continue
            city_needed = min(city_needed, needed - len(starters))
            sample_size = min(city_needed * 4, 10_000)
            if db_pool:
                candidates = sim.sample_live_athletes_from_db(slug, sample_size)
            else:
                candidates = sim.sample_live_pool_city(slug, sample_size)
                if len(candidates) < city_needed:
                    candidates = list(dict.fromkeys(
                        candidates + sim.sample_live_pool(min(sample_size, pool_size))
                    ))
            available = [uid for uid in candidates if str(uid) not in riding_ids]
            pick = random.sample(available, min(city_needed, len(available))) if available else []
            for uid in pick:
                riding_ids.add(str(uid))
            starters.extend(pick)

        users_map_p3 = {}
        if starters:
            users_map_p3 = {
                str(u.id): u
                for u in User.objects.filter(id__in=starters).select_related('tenant')
            }

        for user_id in starters:
            user = users_map_p3.get(str(user_id))
            if not user:
                continue

            act_type = _pick_activity_type()
            distance_m, duration_s = _generate_activity_params(act_type)
            duration_s = max(300, min(3600, duration_s))
            start_time = now
            end_time = now + timedelta(seconds=duration_s)
            is_cheater = random.random() < cheat_ratio

            city_info = resolve_city_for_user(user)
            lat, lon = city_info['lat'], city_info['lon']

            waypoints, route_source = _generate_route_waypoints(lat, lon, distance_m, act_type)
            if route_source == 'grid':
                _maybe_log_brouter_grid_fallback()
            start_lat, start_lon = waypoints[0][0], waypoints[0][1]

            sim.set_live_ride(user_id, {
                'start_time': start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'act_type': act_type,
                'distance_m': distance_m,
                'lat': start_lat,
                'lon': start_lon,
                'city_slug': city_info['slug'],
                'is_cheater': is_cheater,
                'waypoints': waypoints,
                'route_source': route_source,
            })
            started += 1

    # ── Phase 3: Interpolate + push telemetry for ALL active riders ──
    active_rides = sim.get_live_rides()
    telemetry_entries = []

    for user_id, ride in active_rides.items():
        start_time = ride.get('start_time')
        end_time = ride.get('end_time')
        if isinstance(start_time, str):
            start_time = timezone.datetime.fromisoformat(start_time)
        if isinstance(end_time, str):
            end_time = timezone.datetime.fromisoformat(end_time)

        total_s = (end_time - start_time).total_seconds() if start_time and end_time else 1800
        elapsed_s = (now - start_time).total_seconds() if start_time else 0
        progress = max(0, min(1, elapsed_s / total_s if total_s > 0 else 0))

        waypoints = ride.get('waypoints')
        if waypoints and len(waypoints) >= 2:
            clat, clon, course = _interpolate_along_polyline(waypoints, progress)
        else:
            clat = ride.get('lat', 52.2297)
            clon = ride.get('lon', 21.0122)
            course = 0

        speed_kmh = random.uniform(12, 35) if ride.get('act_type') == 'BIKE' else random.uniform(6, 15)

        telemetry_entries.append({
            'deviceId': str(user_id),
            'name': f'Athlete {user_id}',
            'type': ride.get('act_type', 'BIKE'),
            'lat': clat,
            'lng': clon,
            'speed': speed_kmh / 3.6,
            'course': course,
        })

    if len(telemetry_entries) > MAX_TELEMETRY_PUBLISH_PER_TICK:
        telemetry_entries = telemetry_entries[:MAX_TELEMETRY_PUBLISH_PER_TICK]
    TelemetryService.push_bulk_positions(telemetry_entries)

    new_riding = sim.get_live_ride_count()
    sim.set_live_state(
        currently_riding=new_riding,
        total_completed=int(state.get('total_completed', 0)) + completed,
        cheaters_caught=int(state.get('cheaters_caught', 0)) + cheaters,
    )

    if started > 0 or completed > 0:
        ctx = []
        if started > 0:
            ctx.append(f"{started} started")
        if completed > 0:
            ctx.append(f"{completed} completed")
            if cheaters > 0:
                ctx.append(f"{cheaters} cheater{'s' if cheaters > 1 else ''}")
        sim.live_log(f"Tick: {', '.join(ctx)} — {new_riding} riding, 📡 {len(telemetry_entries)} positions")
