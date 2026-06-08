"""
Proactive Postgres disk monitoring, Redis safeguards, and audit trail.

Periodic Celery beat + `manage.py check_disk_guard` evaluate pg_database_size
against the resolved volume budget and set Redis flags consumed by sim tasks.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from activities.scale_config import (
    AUTO_DISK_GUARD,
    DISK_BLOCK_WRITES_PCT,
    DISK_MONITOR_ENABLED,
    DISK_PAUSE_SIM_PCT,
    DISK_WARN_PCT,
    SIM_ACTIVITY_RETENTION_DAYS,
)
from activities.scale_disk_guard import (
    get_database_size_gb,
    resolve_disk_budget_gb,
    warn_unconfigured_disk_budget,
)

logger = logging.getLogger(__name__)

REDIS_KEY_SIMULATION_PAUSED = "scale:simulation_paused"
REDIS_KEY_DISK_WRITES_BLOCKED = "scale:disk_writes_blocked"
REDIS_KEY_LAST_MONITOR_PCT = "scale:disk:last_pct"

EVENT_OK = "ok"
EVENT_WARN = "warn"
EVENT_PAUSE_SIM = "pause_sim"
EVENT_BLOCK_WRITES = "block_writes"
EVENT_CLEARED = "cleared"
EVENT_RETENTION = "retention_cleanup"
EVENT_BUDGET_UNCONFIGURED = "budget_unconfigured"

REDIS_KEY_BUDGET_HINT_SENT = "scale:disk:budget_unconfigured_hint"
REDIS_KEY_BUDGET_HINT_TTL = 86400


def get_disk_usage_snapshot() -> dict[str, Any]:
    """Current Postgres usage vs resolved budget (None fields when unavailable)."""
    db_gb = get_database_size_gb()
    if db_gb is None:
        return {
            "available": False,
            "used_gb": None,
            "budget_gb": None,
            "pct": None,
            "budget_source": None,
        }
    budget, source = resolve_disk_budget_gb(db_gb)
    pct = round(db_gb / budget, 4) if budget > 0 else None
    return {
        "available": True,
        "used_gb": db_gb,
        "budget_gb": budget,
        "pct": pct,
        "budget_source": source,
    }


def _redis():
    from core.redis_cluster import get_redis

    return get_redis()


def _redis_bool(key: str) -> bool:
    try:
        raw = _redis().get(key)
        if raw is None:
            return False
        val = raw.decode() if isinstance(raw, bytes) else str(raw)
        return val.lower() in ("1", "true", "yes", "on")
    except Exception:
        return False


def _maybe_audit_unconfigured_budget(snap: dict[str, Any], *, source: str) -> None:
    """Once per day: audit when budget uses floor/default without SCALE_POSTGRES_DISK_BUDGET_GB."""
    from activities.scale_config import is_postgres_disk_budget_env_set

    budget_source = snap.get("budget_source")
    if budget_source not in ("empty_db_floor", "default") or is_postgres_disk_budget_env_set():
        return
    try:
        if _redis().get(REDIS_KEY_BUDGET_HINT_SENT):
            return
    except Exception:
        pass

    record_disk_audit_event(
        EVENT_BUDGET_UNCONFIGURED,
        used_gb=snap.get("used_gb"),
        budget_gb=snap.get("budget_gb"),
        pct=snap.get("pct"),
        action_taken=(
            "Postgres disk budget inferred from floor/default — "
            "set SCALE_POSTGRES_DISK_BUDGET_GB to your Railway volume size (e.g. 5)"
        ),
        source=source,
        extra={"budget_source": budget_source},
    )
    try:
        _redis().setex(REDIS_KEY_BUDGET_HINT_SENT, REDIS_KEY_BUDGET_HINT_TTL, "1")
    except Exception:
        pass


def _set_redis_bool(key: str, value: bool, ttl_sec: int = 86400 * 2) -> None:
    try:
        r = _redis()
        if value:
            r.setex(key, ttl_sec, "1")
        else:
            r.delete(key)
    except Exception:
        pass


def is_simulation_paused() -> bool:
    return _redis_bool(REDIS_KEY_SIMULATION_PAUSED)


def are_sim_writes_blocked() -> bool:
    return _redis_bool(REDIS_KEY_DISK_WRITES_BLOCKED)


def _evaluate_action(pct: float) -> tuple[str, str, bool, bool]:
    """Return (event_type, action_taken, pause_sim, block_writes)."""
    if pct >= DISK_BLOCK_WRITES_PCT:
        return (
            EVENT_BLOCK_WRITES,
            f"pause simulation + block sim activity writes (disk {pct * 100:.1f}%)",
            True,
            True,
        )
    if pct >= DISK_PAUSE_SIM_PCT:
        return (
            EVENT_PAUSE_SIM,
            f"pause simulation starts (disk {pct * 100:.1f}%)",
            True,
            False,
        )
    if pct >= DISK_WARN_PCT:
        return (
            EVENT_WARN,
            f"warn — disk {pct * 100:.1f}% of budget",
            False,
            False,
        )
    return (
        EVENT_OK,
        "disk usage within limits — safeguards cleared",
        False,
        False,
    )


def record_disk_audit_event(
    event_type: str,
    *,
    used_gb: float | None,
    budget_gb: float | None,
    pct: float | None,
    action_taken: str,
    source: str,
    extra: dict | None = None,
) -> None:
    """Persist audit row and emit structured log line."""
    try:
        from activities.models import DiskAuditEvent

        DiskAuditEvent.objects.create(
            event_type=event_type,
            used_gb=used_gb,
            budget_gb=budget_gb,
            pct=pct,
            action_taken=action_taken[:500],
            source=source[:64],
        )
    except Exception:
        logger.exception("disk_audit: failed to persist DiskAuditEvent")

    payload = {
        "event_type": event_type,
        "used_gb": used_gb,
        "budget_gb": budget_gb,
        "pct": pct,
        "action_taken": action_taken,
        "source": source,
    }
    if extra:
        payload.update(extra)
    logger.info("disk_guard_audit %s", json.dumps(payload, default=str))


def run_disk_monitor(*, source: str = "cron") -> dict[str, Any]:
    """
    Check disk usage, update Redis safeguards, write audit events on transitions
    or when severity >= warn.
    """
    if not DISK_MONITOR_ENABLED or not AUTO_DISK_GUARD:
        return {"skipped": True, "reason": "monitor disabled"}

    snap = get_disk_usage_snapshot()
    if not snap["available"]:
        return {"skipped": True, "reason": "no pg size", **snap}

    warn_unconfigured_disk_budget(snap.get("budget_gb"), snap.get("budget_source"))
    _maybe_audit_unconfigured_budget(snap, source=source)

    pct = float(snap["pct"] or 0)
    event_type, action, pause, block = _evaluate_action(pct)

    was_paused = is_simulation_paused()
    was_blocked = are_sim_writes_blocked()
    _set_redis_bool(REDIS_KEY_SIMULATION_PAUSED, pause)
    _set_redis_bool(REDIS_KEY_DISK_WRITES_BLOCKED, block)

    state_changed = (
        pause != was_paused
        or block != was_blocked
        or event_type in (EVENT_WARN, EVENT_PAUSE_SIM, EVENT_BLOCK_WRITES)
    )
    if event_type == EVENT_OK and (was_paused or was_blocked):
        state_changed = True

    if state_changed:
        audit_type = (
            EVENT_CLEARED if event_type == EVENT_OK and (was_paused or was_blocked) else event_type
        )
        record_disk_audit_event(
            audit_type,
            used_gb=snap["used_gb"],
            budget_gb=snap["budget_gb"],
            pct=pct,
            action_taken=action,
            source=source,
        )

    try:
        _redis().setex(REDIS_KEY_LAST_MONITOR_PCT, 3600, str(round(pct, 4)))
    except Exception:
        pass

    return {
        "ok": True,
        "event_type": event_type,
        "action_taken": action,
        "simulation_paused": pause,
        "writes_blocked": block,
        **snap,
    }


def check_simulation_allowed(source: str) -> tuple[bool, str | None]:
    """Gate batch/live sim starts and heavy batch phases."""
    if not AUTO_DISK_GUARD:
        return True, None

    if is_simulation_paused():
        return False, "Simulation paused: Postgres disk usage critical (scale:simulation_paused)."

    snap = get_disk_usage_snapshot()
    if snap["available"] and snap["pct"] is not None:
        pct = float(snap["pct"])
        if pct >= DISK_PAUSE_SIM_PCT:
            return False, (
                f"Simulation blocked: disk {pct * 100:.1f}% of budget "
                f"({snap['used_gb']:.2f}/{snap['budget_gb']:.1f} GB)."
            )
    return True, None


def check_sim_writes_allowed(source: str) -> tuple[bool, str | None]:
    """Gate live-sim Activity bulk_create and similar sim writes."""
    if not AUTO_DISK_GUARD:
        return True, None

    allowed, reason = check_simulation_allowed(source)
    if not allowed:
        return False, reason

    if are_sim_writes_blocked():
        return False, "Sim activity writes blocked: Postgres disk nearly full."

    snap = get_disk_usage_snapshot()
    if snap["available"] and snap["pct"] is not None:
        pct = float(snap["pct"])
        if pct >= DISK_BLOCK_WRITES_PCT:
            return False, (f"Sim writes blocked: disk {pct * 100:.1f}% of budget.")
    return True, None


def cleanup_simulated_activities(*, source: str = "cron") -> dict[str, Any]:
    """Delete old activities for @aktywnemiasta.pl simulator users (optional retention)."""
    days = int(SIM_ACTIVITY_RETENTION_DAYS or 0)
    if days < 1:
        return {"skipped": True, "reason": "retention disabled"}

    from datetime import timedelta

    from django.utils import timezone

    from activities.models import Activity

    cutoff = timezone.now() - timedelta(days=days)
    qs = Activity.objects.filter(
        user__email__iendswith="@aktywnemiasta.pl",
        created_at__lt=cutoff,
    )
    count, _ = qs.delete()
    if count:
        record_disk_audit_event(
            EVENT_RETENTION,
            used_gb=None,
            budget_gb=None,
            pct=None,
            action_taken=f"deleted {count} simulated activities older than {days}d",
            source=source,
            extra={"deleted": count, "retention_days": days},
        )
    return {"deleted": count, "retention_days": days}
