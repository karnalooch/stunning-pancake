"""
Celery batch simulation tasks (user/activity generation).
Extracted from simulator_tasks.py (Q-P1-8). Task names stay on simulator_tasks facade.
"""

from __future__ import annotations

import logging
import time

from celery import shared_task

from . import simulator_state as sim

logger = logging.getLogger("activities.simulator")


@shared_task(
    bind=True,
    queue="simulation",
    max_retries=0,
    name="activities.simulator_tasks.run_batch_city_users",
)
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


@shared_task(
    bind=True,
    queue="simulation",
    max_retries=0,
    name="activities.simulator_tasks.run_batch_finalize",
)
def run_batch_finalize(self, city_results, skip_activities=False):
    """Chord callback after parallel city user creation."""
    from activities.models import Activity
    from users.models import User

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


@shared_task(
    bind=True,
    queue="simulation",
    max_retries=0,
    name="activities.simulator_tasks.run_batch_simulation",
)
def run_batch_simulation(
    self, scale=0.01, days=30, clear=False, skip_activities=False, total_users=None
):
    """Generate tenants, departments, users, and activities."""
    from activities.scale_config import compute_batch_scaling
    from simulate_active_cities import run
    from users.models import User

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
