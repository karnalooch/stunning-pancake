"""
Chunked background wipe — avoids long DELETE locks on 300k+ rows.
"""

import os
import threading

from celery import shared_task

from activities import wipe_state as ws
from activities.admin_stats import invalidate_dashboard_stats_cache
from activities.scale_config import WIPE_CHUNK_SIZE as CHUNK, WIPE_USER_CHUNK_SIZE
from activities.services import TelemetryService


def _chunk_delete(
    qs,
    label: str,
    deleted: dict,
    progress_base: float,
    progress_span: float,
    total_estimate: int | None = None,
    *,
    chunk_size: int | None = None,
    raw_delete: bool = False,
):
    """
    Delete in PK-ordered chunks. raw_delete skips Django's cascade collector (OOM on
    large User batches); DB ON DELETE CASCADE still applies on PostgreSQL.
    """
    total_removed = 0
    model = qs.model
    using = qs.db
    chunk = max(1, int(chunk_size if chunk_size is not None else CHUNK))
    estimate = max(int(total_estimate or 0), 1)
    base_qs = qs.order_by("pk")
    while True:
        ids = list(base_qs.values_list("pk", flat=True)[:chunk])
        if not ids:
            break
        # Heartbeat before slow delete so stuck detection does not fire mid-chunk.
        frac_before = min(1.0, total_removed / estimate)
        ws.set_wipe_state(
            deleted=deleted,
            progress_pct=round(progress_base + progress_span * frac_before, 1),
            message=f"{label}: deleting {len(ids):,} rows…",
        )
        batch_qs = model.objects.filter(pk__in=ids)
        if raw_delete:
            batch_qs._raw_delete(using=using)
            n = len(ids)
        else:
            n, _ = batch_qs.delete()
        total_removed += n
        deleted[label] = total_removed
        frac = min(1.0, total_removed / estimate)
        progress_pct = round(progress_base + progress_span * frac, 1)
        ws.set_wipe_state(deleted=deleted, progress_pct=progress_pct)
        ws.wipe_log(f"{label}: {total_removed:,} deleted…")
    return total_removed


@shared_task(
    bind=True,
    queue="default",
    max_retries=0,
    name="activities.wipe_tasks.wipe_data_task",
)
def wipe_data_task(self):
    return run_wipe_sync()


def _release_simulator_redis_after_wipe():
    """
    Clear sim locks, live/batch Redis, and telemetry shards.

    Runs on successful wipe and on failure so Live Map recovers after a partial wipe.
    """
    try:
        from activities import simulator_state as sim

        sim.force_stop_live_simulation()
        sim.force_stop_batch_simulation()
        sim.reset_batch_state()
        sim.reset_live_state()
    except Exception:
        pass
    try:
        TelemetryService.clear_simulator_positions()
    except Exception:
        pass
    try:
        invalidate_dashboard_stats_cache()
    except Exception:
        pass


def _clear_disk_guard_after_wipe():
    """Drop pause/block flags so sim can restart after reclaiming space."""
    try:
        from activities.scale_disk_monitor import run_disk_monitor

        run_disk_monitor(source="wipe")
    except Exception:
        pass


def run_wipe_sync():
    if not ws.acquire_wipe_lock():
        state = ws.get_wipe_state()
        if state.get("running"):
            ws.wipe_log("Wipe request ignored: already running (lock held).")
            return {"status": "already_running"}
        ws.wipe_log("Wipe request ignored: lock held by another worker.")
        return {"status": "locked", "error": "lock held"}
    ws.set_wipe_in_progress(True, ttl_seconds=ws.WIPE_LOCK_TTL)

    from django.contrib.auth import get_user_model

    from activities import simulator_state as sim
    from activities.models import Activity
    from users.departments import Department, UserDepartment
    from users.models import Tenant, User

    ws.clear_wipe_log()
    ws.set_wipe_state(
        running=True,
        phase="quiescing",
        progress_pct=1,
        started_at=__import__("time").time(),
        error=None,
        warning=None,
        deleted={},
    )
    ws.wipe_log("Quiescing simulators…")
    sim.force_stop_live_simulation()
    sim.force_stop_batch_simulation()
    deleted = {}

    try:
        activity_estimate = Activity.objects.count()
        ws.set_wipe_state(phase="activities", progress_pct=5)
        deleted["activities"] = _chunk_delete(
            Activity.objects.all(),
            "activities",
            deleted,
            5,
            35,
            total_estimate=activity_estimate,
            raw_delete=True,
        )

        ws.set_wipe_state(phase="departments", progress_pct=40)
        deleted["user_departments"] = _chunk_delete(
            UserDepartment.objects.all(), "user_departments", deleted, 40, 10
        )
        deleted["departments"] = _chunk_delete(
            Department.objects.all(), "departments", deleted, 50, 10
        )

        from users.models import AuditLog
        from users.rbac_models import UserRole

        audit_estimate = AuditLog.objects.count()
        ws.set_wipe_state(phase="audit_logs", progress_pct=55)
        deleted["audit_logs"] = _chunk_delete(
            AuditLog.objects.all(),
            "audit_logs",
            deleted,
            55,
            5,
            total_estimate=audit_estimate,
            raw_delete=True,
        )
        role_estimate = UserRole.objects.exclude(user__role="GLOBAL_OWNER").count()
        deleted["user_roles"] = _chunk_delete(
            UserRole.objects.exclude(user__role="GLOBAL_OWNER"),
            "user_roles",
            deleted,
            58,
            2,
            total_estimate=role_estimate,
            raw_delete=True,
        )

        User = get_user_model()
        user_estimate = User.objects.exclude(role="GLOBAL_OWNER").count()
        ws.set_wipe_state(phase="users", progress_pct=60)
        deleted["users"] = _chunk_delete(
            User.objects.exclude(role="GLOBAL_OWNER"),
            "users",
            deleted,
            60,
            30,
            total_estimate=user_estimate,
            chunk_size=WIPE_USER_CHUNK_SIZE,
            raw_delete=True,
        )

        ws.set_wipe_state(phase="tenants", progress_pct=92)
        deleted["tenants"] = _chunk_delete(Tenant.objects.all(), "tenants", deleted, 92, 5)

        ws.set_wipe_state(phase="finalizing", progress_pct=96, message="Recreating Global Owner…")
        owner, _ = User.objects.get_or_create(
            username="global_owner",
            defaults={
                "email": "owner@4velo.app",
                "role": "GLOBAL_OWNER",
                "is_superuser": True,
                "is_staff": True,
            },
        )
        owner.set_password(os.getenv("GLOBAL_OWNER_PASSWORD", "admin123"))
        owner.is_superuser = True
        owner.is_staff = True
        owner.role = "GLOBAL_OWNER"
        owner.save()

        _release_simulator_redis_after_wipe()

        ws.wipe_log("Postgres VACUUM (reclaim space)…")
        vacuum_err = _vacuum_postgres_if_needed()

        _clear_disk_guard_after_wipe()

        ws.set_wipe_state(
            running=False,
            phase="complete",
            progress_pct=100,
            completed_at=__import__("time").time(),
            deleted=deleted,
            error=None,
            warning=vacuum_err,
        )
        ws.wipe_log("✅ Wipe complete." + (f" (VACUUM: {vacuum_err})" if vacuum_err else ""))
        out = {"status": "complete", "deleted": deleted}
        if vacuum_err:
            out["warning"] = vacuum_err
        return out
    except Exception as e:
        from activities.scale_disk_guard import is_disk_full_error

        err_msg = str(e)
        if is_disk_full_error(e):
            err_msg = (
                f"{err_msg} — Postgres disk full. Expand volume or free space, then retry wipe."
            )
        ws.set_wipe_state(
            running=False,
            phase="error",
            error=err_msg,
            deleted=deleted,
        )
        ws.wipe_log(f"ERROR: {err_msg}")
        return {"status": "error", "error": err_msg, "deleted": deleted}
    finally:
        state = ws.get_wipe_state()
        if state.get("phase") == "error" or state.get("error"):
            try:
                _release_simulator_redis_after_wipe()
                ws.wipe_log(
                    "Simulator Redis/telemetry cleared after wipe error (Live Map recovery)."
                )
            except Exception:
                pass
        ws.set_wipe_in_progress(False)
        ws.release_wipe_lock()


def _vacuum_postgres_if_needed() -> str | None:
    """Reclaim disk after large deletes (must run outside a transaction)."""
    from django.db import connection

    if connection.vendor != "postgresql":
        return None
    try:
        old_autocommit = connection.get_autocommit()
        connection.set_autocommit(True)
        try:
            with connection.cursor() as cursor:
                cursor.execute("VACUUM (ANALYZE)")
        finally:
            connection.set_autocommit(old_autocommit)
        return None
    except Exception as exc:
        return str(exc)


def start_wipe_async() -> str:
    """
    Dispatch wipe via Celery default queue or a backend thread.

    Returns dispatch mode: 'celery' | 'thread'.
    Caller should set queued state before calling (see mark_wipe_queued).
    """
    import os

    thread_env = os.getenv("WIPE_ALWAYS_THREAD", "") or os.getenv("WIPE_USE_BACKEND_THREAD", "")
    if thread_env.lower() in ("1", "true", "yes"):
        threading.Thread(target=run_wipe_sync, daemon=True, name="wipe-data").start()
        return "thread"
    if "sqlite" in os.getenv("DATABASE_URL", ""):
        threading.Thread(target=run_wipe_sync, daemon=True, name="wipe-data").start()
        return "thread"
    try:
        wipe_data_task.delay()
        return "celery"
    except Exception:
        threading.Thread(target=run_wipe_sync, daemon=True, name="wipe-data").start()
        return "thread"
