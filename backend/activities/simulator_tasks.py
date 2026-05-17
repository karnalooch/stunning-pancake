"""
Celery Tasks for Simulator
============================
Background tasks that run the simulation logic.
"""
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import random
import time
import json

from . import simulator_state as sim


@shared_task(bind=True, queue='simulation', max_retries=0)
def run_batch_simulation(self, scale=0.01, days=30, clear=False, skip_activities=False, total_users=None):
    """
    Run batch simulation as a Celery task.
    Creates tenants, departments, users, and optionally activities.
    """
    from simulate_active_cities import run
    from users.models import User

    if not sim.acquire_batch_lock():
        sim.batch_log("ERROR: Could not acquire batch lock (another simulation running)")
        sim.set_batch_state(error='Another simulation is already running', running=False)
        return {'status': 'locked'}

    try:
        sim.reset_batch_state()
        sim.set_batch_state(
            running=True, started_at=time.time(), scale=scale, days=days,
            total_users=total_users or 0, current_phase='initializing', progress_pct=0
        )
        sim.batch_log(f"Batch simulation starting: scale={scale}, days={days}, clear={clear}, total_users={total_users}")

        # Phase 1: Tenants
        sim.set_batch_state(current_phase='creating_tenants', progress_pct=10)
        sim.batch_log("Phase 1: Creating tenants...")

        # Phase 2: Departments
        sim.set_batch_state(current_phase='creating_departments', progress_pct=25)
        sim.batch_log("Phase 2: Creating departments...")

        # Phase 3: Users
        sim.set_batch_state(current_phase='creating_users', progress_pct=40)
        sim.batch_log("Phase 3: Creating users...")

        # Phase 4: Activities (if not skipped)
        if not skip_activities:
            sim.set_batch_state(current_phase='creating_activities', progress_pct=60)
            sim.batch_log("Phase 4: Creating activities with GPS tracks...")

        # Run the actual simulation
        run(scale=scale, days=days, clear=clear, dry_run=False, skip_activities=skip_activities, total_users=total_users)

        # Count results
        user_count = User.objects.filter(role='ATHLETE').count()
        from activities.models import Activity
        activity_count = Activity.objects.count()

        sim.set_batch_state(
            current_phase='complete', progress_pct=100,
            users_created=user_count, activities_created=activity_count,
            running=False, completed_at=time.time()
        )
        sim.batch_log(f"Simulation complete: {user_count} users, {activity_count} activities")

        return {'status': 'complete', 'users': user_count, 'activities': activity_count}

    except Exception as e:
        sim.set_batch_state(error=str(e), running=False, completed_at=time.time())
        sim.batch_log(f"ERROR: {e}")
        return {'status': 'error', 'error': str(e)}
    finally:
        sim.release_batch_lock()


@shared_task(bind=True, queue='simulation', max_retries=0)
def run_live_simulation(self, total_users=100, active_ratio=0.25, cheat_ratio=0.05, tick_seconds=10):
    """
    Orchestrator task for live simulation.
    Spawns tick tasks on a schedule.
    """
    from users.models import User

    if not sim.acquire_live_lock():
        sim.live_log("ERROR: Could not acquire live lock (another live sim running)")
        sim.set_live_state(error='Another live simulation is already running', running=False)
        return {'status': 'locked'}

    try:
        sim.reset_live_state()
        sim.set_live_state(
            running=True, started_at=time.time(),
            total_users=total_users, active_ratio=active_ratio,
            cheat_ratio=cheat_ratio, tick_seconds=tick_seconds,
            currently_riding=0, total_completed=0, cheaters_caught=0
        )

        # Build user pool
        user_ids = list(User.objects.filter(role='ATHLETE').values_list('id', flat=True)[:total_users])
        sim.set_live_pool(user_ids)
        sim.set_live_state(total_users=len(user_ids))

        if len(user_ids) < total_users:
            sim.live_log(f"WARNING: Only {len(user_ids)} athlete users available (requested {total_users})")

        sim.live_log(f"LIVE SIMULATION: {len(user_ids)} users, {active_ratio*100:.0f}% active, {cheat_ratio*100:.0f}% cheaters, tick={tick_seconds}s")

        # Run ticks in a loop (this task runs until aborted)
        tick_count = 0
        while True:
            # Check abort flag
            state = sim.get_live_state()
            if not state.get('running', False):
                sim.live_log("Live simulation stopped (running=false).")
                break

            # Run one tick
            live_tick_task.delay()
            tick_count += 1

            # Refresh lock
            sim.refresh_live_lock()

            # Sleep between ticks
            for _ in range(tick_seconds):
                state = sim.get_live_state()
                if not state.get('running', False):
                    break
                time.sleep(1)

        sim.live_log(f"Live simulation stopped after {tick_count} ticks.")
        return {'status': 'stopped', 'ticks': tick_count}

    except Exception as e:
        sim.set_live_state(error=str(e), running=False)
        sim.live_log(f"FATAL ERROR: {e}")
        return {'status': 'error', 'error': str(e)}
    finally:
        sim.release_live_lock()


@shared_task(bind=True, queue='simulation', max_retries=0)
def live_tick_task(self):
    """
    One tick of the live simulator: finish rides that ended, start new rides.
    """
    from users.models import User
    from activities.models import Activity
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
    completed = 0
    cheaters = 0

    # Phase 1: Finish rides whose end_time has passed
    rides_to_remove = []
    for user_id, ride in active_rides.items():
        end_time = ride.get('end_time')
        if end_time:
            # Parse ISO format datetime
            if isinstance(end_time, str):
                end_time = timezone.datetime.fromisoformat(end_time)
            if now >= end_time:
                rides_to_remove.append(user_id)

                try:
                    user = User.objects.get(id=user_id)
                except User.DoesNotExist:
                    continue

                tenant_name = user.tenant.name if user.tenant else None
                city_info = next((c for c in CITIES if c['name'] == tenant_name), None)
                if not city_info:
                    continue

                distance_m = ride.get('distance_m', 5000)
                act_type = ride.get('act_type', 'RUN')
                is_cheater = ride.get('is_cheater', False)
                start_time = ride.get('start_time')
                if isinstance(start_time, str):
                    start_time = timezone.datetime.fromisoformat(start_time)

                if is_cheater:
                    from django.contrib.gis.geos import LineString
                    import math
                    cos_lat = math.cos(math.radians(city_info['lat']))
                    deg_per_km = 1.0 / 111.0
                    total_deg = (distance_m / 1000.0) * deg_per_km
                    n_points = 8
                    coords = []
                    for i in range(n_points):
                        t = i / (n_points - 1)
                        coords.append((
                            city_info['lon'] + total_deg * t / cos_lat + (0 if i == 0 or i == n_points - 1 else random.uniform(-0.00001, 0.00001)),
                            city_info['lat'] + total_deg * t + (0 if i == 0 or i == n_points - 1 else random.uniform(-0.00001, 0.00001)),
                        ))
                    route = LineString(coords, srid=4326)
                    is_verified = False
                    score = random.uniform(0.0, 0.25)
                    cheaters += 1
                else:
                    try:
                        from simulate_active_cities import _generate_gps_track
                        route = _generate_gps_track(city_info['lat'], city_info['lon'], distance_m, act_type)
                    except Exception:
                        route = None
                    is_verified = random.random() < 0.92
                    score = random.uniform(0.7, 1.0) if is_verified else random.uniform(0.0, 0.4)

                duration_s = (now - start_time).total_seconds() if start_time else 1800
                activities_to_create.append(Activity(
                    user=user, tenant=user.tenant, type=act_type,
                    start_time=start_time or now, end_time=now,
                    distance=distance_m, duration=timedelta(seconds=duration_s),
                    is_verified=is_verified, verification_score=score,
                    route_path=route,
                ))
                completed += 1

    # Bulk create completed activities
    if activities_to_create:
        try:
            Activity.objects.bulk_create(activities_to_create)
        except Exception:
            for a in activities_to_create:
                try:
                    a.save()
                except Exception:
                    pass

    # Remove finished rides
    for uid in rides_to_remove:
        sim.delete_live_ride(uid)

    # Phase 2: Start new rides
    current_riding = sim.get_live_ride_count()
    target_riding = max(1, int(total_users * active_ratio))
    needed = max(0, target_riding - current_riding)

    if needed > 0 and pool:
        # Get available users (not already riding)
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

    # Update counters
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
        sim.live_log(f"Tick: {needed} started, {ctx} — {new_riding} riding")
