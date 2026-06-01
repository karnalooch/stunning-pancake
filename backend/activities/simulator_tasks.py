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

# ── Road-following waypoint generator (uses BRouter for real road routes) ──
def _generate_road_waypoints(lat: float, lon: float, distance_m: float, activity_type: str) -> list[tuple[float, float]]:
    """
    Generate road-following waypoints using BRouter.
    Falls back to grid-based pattern if BRouter is unavailable.
    Results are cached per (lat,lon,distance,type) for 1 hour.
    """
    cache_key = f"road_wp:{lat:.4f}:{lon:.4f}:{distance_m}:{activity_type}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Shift start point ~500m away to force BRouter to generate a real route
    cos_lat = math.cos(math.radians(lat))
    start_lat = lat + random.uniform(-0.005, 0.005)
    start_lon = lon + random.uniform(-0.005, 0.005)
    
    # Generate endpoint ~distance_m away in a random direction
    bearing = random.uniform(0, 2 * math.pi)
    km = distance_m / 1000.0
    end_lat = lat + (km / 111.0) * math.cos(bearing) * 0.7
    end_lon = lon + (km / (111.0 * cos_lat)) * math.sin(bearing) * 0.8

    try:
        result = BRouterService.validate_track(activity_type, [
            [start_lon, start_lat],
            [end_lon, end_lat],
        ])

        if result.get('success') and result.get('raw_data'):
            features = result['raw_data'].get('features', [])
            if features:
                coords = features[0]['geometry']['coordinates']
                # BRouter returns [lon, lat], convert to [(lat, lon)] waypoints
                waypoints = [(c[1], c[0]) for c in coords]
                if len(waypoints) >= 2:
                    cache.set(cache_key, waypoints, 3600)
                    return waypoints
    except Exception:
        pass

    return _generate_grid_waypoints(lat, lon)


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
    if sim.get_live_pool_count() == 0:
        from activities.scale_config import MAX_LIVE_POOL
        pool_limit = min(pool_target, MAX_LIVE_POOL)
        pool_size = sim.set_live_pool_from_db(pool_limit)
        sim.set_live_state(total_users=pool_size)
        if pool_size < pool_target:
            sim.live_log(f"WARNING: only {pool_size} athletes in pool (wanted {pool_target})")
        sim.live_log(
            f"LIVE SIM: pool={pool_size}, {active_ratio*100:.0f}% active (capped), "
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
    from simulate_active_cities import CITIES, _pick_activity_type, _generate_activity_params

    state = sim.get_live_state()
    if not state.get('running', False):
        return

    now = timezone.now()
    from activities.scale_config import MAX_CONCURRENT_RIDERS, MAX_TELEMETRY_PUBLISH_PER_TICK

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

    # ── Phase 2: Start new rides (capped — never 90k concurrent in Redis) ──
    current_riding = sim.get_live_ride_count()
    target_riding = min(
        MAX_CONCURRENT_RIDERS,
        max(1, int(total_users * active_ratio)),
    )
    needed = max(0, target_riding - current_riding)
    started = 0

    if needed > 0 and pool_size > 0:
        riding_ids = set(active_rides.keys())
        sample_size = min(needed * 3, pool_size, 50_000)
        candidates = sim.sample_live_pool(sample_size)
        available = [uid for uid in candidates if uid not in riding_ids]
        starters = random.sample(available, min(needed, len(available))) if available else []

        users_map_p3 = {}
        if starters:
            users_map_p3 = {str(u.id): u for u in User.objects.filter(id__in=starters).select_related('tenant')}

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

            tenant_name = user.tenant.name if user.tenant else None
            city_info = next((c for c in CITIES if c['name'] == tenant_name), None)
            lat = city_info['lat'] if city_info else 52.2297
            lon = city_info['lon'] if city_info else 21.0122

            if random.random() < 0.3:
                waypoints = _generate_road_waypoints(lat, lon, distance_m, act_type)
            else:
                waypoints = _generate_grid_waypoints(lat, lon)

            sim.set_live_ride(user_id, {
                'start_time': start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'act_type': act_type,
                'distance_m': distance_m,
                'lat': lat,
                'lon': lon,
                'is_cheater': is_cheater,
                'waypoints': waypoints,
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

        lat = ride.get('lat', 52.2297)
        lon = ride.get('lon', 21.0122)
        total_s = (end_time - start_time).total_seconds() if start_time and end_time else 1800
        elapsed_s = (now - start_time).total_seconds() if start_time else 0
        progress = max(0, min(1, elapsed_s / total_s if total_s > 0 else 0))

        waypoints = ride.get('waypoints')
        if waypoints and len(waypoints) >= 2:
            total_wp = len(waypoints) - 1
            wp_idx_float = progress * total_wp
            wp_idx_int = int(wp_idx_float)
            wp_frac = wp_idx_float - wp_idx_int

            if wp_idx_int >= total_wp:
                clat = waypoints[-1][0]
                clon = waypoints[-1][1]
            else:
                wp_a = waypoints[wp_idx_int]
                wp_b = waypoints[wp_idx_int + 1]
                clat = wp_a[0] + (wp_b[0] - wp_a[0]) * wp_frac
                clon = wp_a[1] + (wp_b[1] - wp_a[1]) * wp_frac

            if wp_idx_int < total_wp:
                dlat = waypoints[wp_idx_int + 1][0] - waypoints[wp_idx_int][0]
                dlon = waypoints[wp_idx_int + 1][1] - waypoints[wp_idx_int][1]
                course = int((math.degrees(math.atan2(dlon, dlat)) + 360) % 360)
            else:
                course = random.randint(0, 359)
        else:
            block_size = 0.0015
            grid_steps = 8
            grid_lat, grid_lon = lat, lon
            wp = [(grid_lat, grid_lon)]
            for _ in range(grid_steps):
                r = random.random()
                if r < 0.33:
                    grid_lat += block_size * random.choice([-1, 1])
                elif r < 0.66:
                    grid_lon += block_size * random.choice([-1, 1])
                else:
                    grid_lat += block_size * 0.5 * random.choice([-1, 1])
                    grid_lon += block_size * 0.5 * random.choice([-1, 1])
                wp.append((grid_lat, grid_lon))

            total_wp = len(wp) - 1
            wp_idx_float = progress * total_wp
            wp_idx_int = int(wp_idx_float)
            wp_frac = wp_idx_float - wp_idx_int
            if wp_idx_int >= total_wp:
                clat = wp[-1][0]
                clon = wp[-1][1]
            else:
                clat = wp[wp_idx_int][0] + (wp[wp_idx_int + 1][0] - wp[wp_idx_int][0]) * wp_frac
                clon = wp[wp_idx_int][1] + (wp[wp_idx_int + 1][1] - wp[wp_idx_int][1]) * wp_frac
            course = random.randint(0, 359)

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
