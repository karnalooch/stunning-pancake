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

from . import simulator_state as sim


@shared_task(bind=True, queue='simulation', max_retries=0)
def run_batch_simulation(self, scale=0.01, days=30, clear=False,
                          skip_activities=False, total_users=None):
    """Generate tenants, departments, users, and activities."""
    from simulate_active_cities import run
    from users.models import User

    if not sim.acquire_batch_lock():
        sim.batch_log("ERROR: batch lock — another simulation running")
        sim.set_batch_state(error='Another simulation is running', running=False)
        return {'status': 'locked'}

    try:
        sim.reset_batch_state()
        sim.set_batch_state(
            running=True, started_at=time.time(), scale=scale, days=days,
            total_users=total_users or 0, current_phase='initializing', progress_pct=0,
        )
        sim.batch_log(f"Batch starting: scale={scale}, days={days}, total_users={total_users}")

        sim.set_batch_state(current_phase='generating', progress_pct=10)
        run(scale=scale, days=days, clear=clear, dry_run=False,
            skip_activities=skip_activities, total_users=total_users)

        user_count = User.objects.filter(role='ATHLETE').count()
        from activities.models import Activity
        activity_count = Activity.objects.count()

        sim.set_batch_state(
            current_phase='complete', progress_pct=100,
            users_created=user_count, activities_created=activity_count,
            running=False, completed_at=time.time(),
        )
        sim.batch_log(f"Done: {user_count} users, {activity_count} activities")
        return {'status': 'complete', 'users': user_count, 'activities': activity_count}

    except Exception as e:
        sim.set_batch_state(error=str(e), running=False, completed_at=time.time())
        sim.batch_log(f"ERROR: {e}")
        return {'status': 'error', 'error': str(e)}
    finally:
        sim.release_batch_lock()


@shared_task(bind=True, queue='simulation', max_retries=0)
def run_live_simulation(self, total_users=100, active_ratio=0.25,
                         cheat_ratio=0.05, tick_seconds=10):
    """Orchestrator — dispatches tick tasks that push live telemetry."""
    from users.models import User

    if not sim.acquire_live_lock():
        sim.live_log("ERROR: live lock — another simulation running")
        sim.set_live_state(error='Another live simulation is running', running=False)
        return {'status': 'locked'}

    try:
        sim.reset_live_state()
        sim.set_live_state(
            running=True, started_at=time.time(),
            total_users=total_users, active_ratio=active_ratio,
            cheat_ratio=cheat_ratio, tick_seconds=tick_seconds,
            currently_riding=0, total_completed=0, cheaters_caught=0,
        )

        user_ids = list(User.objects.filter(role='ATHLETE').values_list('id', flat=True)[:total_users])
        sim.set_live_pool(user_ids)
        sim.set_live_state(total_users=len(user_ids))

        if len(user_ids) < total_users:
            sim.live_log(f"WARNING: only {len(user_ids)} athletes (wanted {total_users})")

        sim.live_log(
            f"LIVE SIM: {len(user_ids)} users, {active_ratio*100:.0f}% active, "
            f"{cheat_ratio*100:.0f}% cheaters, tick={tick_seconds}s"
        )

        tick_count = 0
        while True:
            state = sim.get_live_state()
            if not state.get('running', False):
                sim.live_log("Live simulation stopped.")
                break

            live_tick_task.delay()
            tick_count += 1
            sim.refresh_live_lock()

            for _ in range(tick_seconds):
                state = sim.get_live_state()
                if not state.get('running', False):
                    break
                time.sleep(1)

        sim.live_log(f"Live simulation ended after {tick_count} ticks.")
        return {'status': 'stopped', 'ticks': tick_count}

    except Exception as e:
        sim.set_live_state(error=str(e), running=False)
        sim.live_log(f"FATAL: {e}")
        return {'status': 'error', 'error': str(e)}
    finally:
        sim.release_live_lock()


@shared_task(bind=True, queue='simulation', max_retries=0)
def live_tick_task(self):
    """One tick: finish rides, start new ones, push telemetry to Redis."""
    from users.models import User
    from activities.models import Activity
    from activities.services import TelemetryService
    from simulate_active_cities import CITIES, _pick_activity_type, _generate_activity_params

    state = sim.get_live_state()
    if not state.get('running', False):
        return

    now = timezone.now()
    pool = sim.get_live_pool()
    active_rides = sim.get_live_rides()
    cheat_ratio = state['cheat_ratio']
    active_ratio = state['active_ratio']
    total_users = state['total_users']

    activities_to_create = []
    telemetry_entries = []
    completed = 0
    cheaters = 0

    # ── Phase 1: Interpolate current position for ALL riding users (TELEMETRY) ──
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

        # Circular route: interpolate position on a circle/spiral
        angle = progress * 2 * math.pi * 3  # 3 loops around
        radius = 0.003 * (0.5 + 0.5 * math.sin(progress * math.pi))  # varying radius
        clat = lat + radius * math.cos(angle) * 0.7
        clon = lon + radius * math.sin(angle) * 1.0
        speed_kmh = random.uniform(12, 35) if ride.get('act_type') == 'BIKE' else random.uniform(6, 15)

        telemetry_entries.append({
            'deviceId': str(user_id),
            'name': f'Athlete {user_id}',
            'type': ride.get('act_type', 'BIKE'),
            'lat': clat,
            'lng': clon,
            'speed': speed_kmh / 3.6,
            'course': random.randint(0, 359),
        })

    # Push ALL telemetry at once
    TelemetryService.push_bulk_positions(telemetry_entries)

    # ── Phase 2: Finish expired rides ──
    rides_to_remove = []
    for user_id, ride in active_rides.items():
        end_time = ride.get('end_time')
        if isinstance(end_time, str):
            end_time = timezone.datetime.fromisoformat(end_time)
        if end_time and now >= end_time:
            rides_to_remove.append(user_id)

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                continue

            distance_m = ride.get('distance_m', 5000)
            act_type = ride.get('act_type', 'RUN')
            is_cheater = ride.get('is_cheater', False)
            start_time = ride.get('start_time')
            if isinstance(start_time, str):
                start_time = timezone.datetime.fromisoformat(start_time)

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
            Activity.objects.bulk_create(activities_to_create)
        except Exception:
            for a in activities_to_create:
                try:
                    a.save()
                except Exception:
                    pass

    for uid in rides_to_remove:
        sim.delete_live_ride(uid)

    # ── Phase 3: Start new rides ──
    current_riding = sim.get_live_ride_count()
    target_riding = max(1, int(total_users * active_ratio))
    needed = max(0, target_riding - current_riding)

    if needed > 0 and pool:
        riding_ids = set(sim.get_live_rides().keys())
        available = [uid for uid in pool if uid not in riding_ids]
        starters = random.sample(available, min(needed, len(available)))

        for user_id in starters:
            act_type = _pick_activity_type()
            distance_m, duration_s = _generate_activity_params(act_type)
            duration_s = max(300, min(3600, duration_s))
            start_time = now
            end_time = now + timedelta(seconds=duration_s)
            is_cheater = random.random() < cheat_ratio

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                continue
            tenant_name = user.tenant.name if user.tenant else None
            city_info = next((c for c in CITIES if c['name'] == tenant_name), None)
            lat = city_info['lat'] if city_info else 52.2297
            lon = city_info['lon'] if city_info else 21.0122

            ride_data = {
                'start_time': start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'act_type': act_type,
                'distance_m': distance_m,
                'lat': lat,
                'lon': lon,
                'is_cheater': is_cheater,
            }
            sim.set_live_ride(user_id, ride_data)

    new_riding = sim.get_live_ride_count()
    sim.set_live_state(
        currently_riding=new_riding,
        total_completed=state['total_completed'] + completed,
        cheaters_caught=state['cheaters_caught'] + cheaters,
    )

    if completed > 0:
        ctx = f"{completed} completed"
        if cheaters > 0:
            ctx += f", {cheaters} cheater{'s' if cheaters > 1 else ''}"
        sim.live_log(f"Tick: {needed} started, {ctx} — {new_riding} riding, 📡 telemetry pushed")
