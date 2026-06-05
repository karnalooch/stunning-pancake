"""Redis-backed progress for chunked async data wipe."""

import json
import time

from core.redis_cluster import get_redis

WIPE_STATE_KEY = "{admin}:wipe:state"
WIPE_LOG_KEY = "{admin}:wipe:log"
WIPE_LOCK_KEY = "{admin}:wipe:lock"
WIPE_IN_PROGRESS_KEY = "{admin}:wipe:in_progress"
WIPE_LOCK_TTL = 3600
# Queued but Celery never picked up the task (common after worker restart).
WIPE_STALE_QUEUED_SEC = int(__import__("os").getenv("WIPE_STALE_QUEUED_SEC", "120"))
# Running phase with no last_progress_at updates (legacy / first chunk).
WIPE_STALE_RUNNING_SEC = int(__import__("os").getenv("WIPE_STALE_RUNNING_SEC", "900"))
# No Redis progress touch for this long while running (chunk stalled).
WIPE_STALE_NO_PROGRESS_SEC = int(__import__("os").getenv("WIPE_STALE_NO_PROGRESS_SEC", "180"))
# Users phase may use a longer cap (max with NO_PROGRESS) — large deletes can exceed 3 min/chunk.
WIPE_STALE_USERS_SEC = int(__import__("os").getenv("WIPE_STALE_USERS_SEC", "300"))

# Ordered phases for tables_done / tables_total progress.
WIPE_PHASE_ORDER = (
    "queued",
    "quiescing",
    "activities",
    "departments",
    "audit_logs",
    "users",
    "tenants",
    "finalizing",
    "complete",
)

PHASE_MESSAGES = {
    "queued": "Wipe queued — waiting for worker",
    "quiescing": "Stopping simulations",
    "starting": "Starting wipe",
    "activities": "Deleting activities",
    "departments": "Deleting departments and memberships",
    "audit_logs": "Clearing audit logs (FK to users)",
    "users": "Deleting users (except Global Owner)",
    "tenants": "Deleting tenants",
    "finalizing": "Recreating Global Owner and reclaiming disk",
    "complete": "Wipe complete",
    "error": "Wipe failed",
}


def _redis_str(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(value)
    return str(value)


def _redis_optional_str(raw) -> str | None:
    if raw is None or raw == "" or raw == "None":
        return None
    return raw


def _parse_float(raw) -> float | None:
    if raw is None or raw == "" or raw == "None":
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def get_wipe_state() -> dict:
    r = get_redis()
    raw = r.hgetall(WIPE_STATE_KEY)
    if not raw:
        return _empty_wipe_state()
    state = {
        k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v
        for k, v in raw.items()
    }
    state["running"] = state.get("running", "false").lower() == "true"
    state["progress_pct"] = float(state.get("progress_pct", 0) or 0)
    state["tables_done"] = int(state.get("tables_done", 0) or 0)
    state["tables_total"] = int(state.get("tables_total", len(WIPE_PHASE_ORDER) - 2) or 0)
    state["rows_deleted"] = int(state.get("rows_deleted", 0) or 0)
    state["error"] = _redis_optional_str(state.get("error"))
    state["warning"] = _redis_optional_str(state.get("warning"))
    state["message"] = _redis_optional_str(state.get("message"))
    state["started_at"] = _parse_float(state.get("started_at"))
    state["last_progress_at"] = _parse_float(state.get("last_progress_at"))
    state["completed_at"] = _parse_float(state.get("completed_at"))
    if state.get("deleted"):
        try:
            state["deleted"] = json.loads(state["deleted"])
        except json.JSONDecodeError:
            state["deleted"] = {}
    else:
        state["deleted"] = {}
    if not state.get("message") and state.get("phase"):
        state["message"] = PHASE_MESSAGES.get(state["phase"], state["phase"])
    state["rows_deleted"] = state["rows_deleted"] or sum(
        int(v) for v in state["deleted"].values() if isinstance(v, (int, float))
    )
    return state


def _empty_wipe_state() -> dict:
    tables_total = max(1, len(WIPE_PHASE_ORDER) - 2)
    return {
        "running": False,
        "phase": "idle",
        "progress_pct": 0,
        "error": None,
        "warning": None,
        "message": None,
        "deleted": {},
        "tables_done": 0,
        "tables_total": tables_total,
        "rows_deleted": 0,
        "started_at": None,
        "last_progress_at": None,
        "completed_at": None,
    }


def set_wipe_state(**kwargs):
    touch_progress = kwargs.pop("touch_progress", True)
    if touch_progress:
        kwargs["last_progress_at"] = time.time()
    deleted = kwargs.pop("deleted", None)
    if deleted is not None:
        kwargs["deleted"] = deleted
        kwargs["rows_deleted"] = sum(
            int(v) for v in deleted.values() if isinstance(v, (int, float))
        )
    phase = kwargs.get("phase")
    if phase and "message" not in kwargs:
        kwargs["message"] = PHASE_MESSAGES.get(phase, str(phase))
    if phase and phase in WIPE_PHASE_ORDER and "tables_done" not in kwargs:
        idx = WIPE_PHASE_ORDER.index(phase)
        # queued=0, quiescing=1, … complete = last
        kwargs["tables_done"] = min(idx, len(WIPE_PHASE_ORDER) - 2)
    if "tables_total" not in kwargs:
        kwargs.setdefault("tables_total", max(1, len(WIPE_PHASE_ORDER) - 2))
    r = get_redis()
    mapping = {k: _redis_str(v) for k, v in kwargs.items()}
    r.hset(WIPE_STATE_KEY, mapping=mapping)
    r.expire(WIPE_STATE_KEY, 86400)


def wipe_log(msg: str):
    r = get_redis()
    ts = time.strftime("%H:%M:%S")
    r.rpush(WIPE_LOG_KEY, json.dumps([ts, msg]))
    r.ltrim(WIPE_LOG_KEY, -100, -1)


def get_wipe_log() -> list:
    r = get_redis()
    raw = r.lrange(WIPE_LOG_KEY, 0, -1)
    return [json.loads(line.decode() if isinstance(line, bytes) else line) for line in raw]


def reset_wipe_state():
    r = get_redis()
    r.delete(WIPE_STATE_KEY, WIPE_LOG_KEY)


def clear_wipe_log():
    r = get_redis()
    r.delete(WIPE_LOG_KEY)


def mark_wipe_queued():
    """Set running before async dispatch so polls do not treat idle as complete."""
    tables_total = max(1, len(WIPE_PHASE_ORDER) - 2)
    set_wipe_state(
        running=True,
        phase="queued",
        progress_pct=0,
        error=None,
        warning=None,
        deleted={},
        tables_done=0,
        tables_total=tables_total,
        rows_deleted=0,
        message=PHASE_MESSAGES["queued"],
        started_at=time.time(),
        last_progress_at=time.time(),
        completed_at=None,
    )


def wipe_status_label(state: dict) -> str:
    """idle | queued | running | complete | error — used by API and clients."""
    phase = state.get("phase") or "idle"
    if phase == "complete":
        return "complete"
    if phase == "error":
        return "error"
    err = state.get("error")
    if err and phase != "complete":
        return "error"
    if state.get("running"):
        return "queued" if phase in ("queued", "starting") else "running"
    return "idle"


def serialize_wipe_response(
    state: dict, *, stuck: bool | None = None, log: list | None = None
) -> dict:
    """Structured payload for GET/DELETE wipe-data."""
    label = wipe_status_label(state)
    stuck_reason = None
    if stuck is None:
        stuck_reason = wipe_stuck_reason(state)
        stuck = stuck_reason is not None
    elif stuck:
        stuck_reason = wipe_stuck_reason(state)
    out = {
        **state,
        "status": label,
        "stuck": stuck,
        "phase_label": PHASE_MESSAGES.get(state.get("phase") or "idle", state.get("phase")),
    }
    if stuck and stuck_reason:
        out["stuck_reason"] = stuck_reason
    if log is not None:
        out["log"] = log
    return out


def acquire_wipe_lock() -> bool:
    r = get_redis()
    return bool(r.set(WIPE_LOCK_KEY, "1", nx=True, ex=WIPE_LOCK_TTL))


def release_wipe_lock():
    r = get_redis()
    r.delete(WIPE_LOCK_KEY)


def set_wipe_in_progress(enabled: bool, ttl_seconds: int = 3600) -> None:
    """Global barrier checked by simulator start endpoints."""
    r = get_redis()
    if enabled:
        r.set(WIPE_IN_PROGRESS_KEY, "1", ex=max(60, int(ttl_seconds)))
        return
    r.delete(WIPE_IN_PROGRESS_KEY)


def is_wipe_in_progress() -> bool:
    r = get_redis()
    return bool(r.exists(WIPE_IN_PROGRESS_KEY))


def _parse_started_at(state: dict) -> float | None:
    return _parse_float(state.get("started_at"))


def wipe_stuck_reason(state: dict) -> str | None:
    """Short reason when running but no worker progress; None if not stuck."""
    if not state.get("running"):
        return None
    started = _parse_started_at(state)
    if started is None:
        return "no_started_at"
    now = time.time()
    phase = (state.get("phase") or "").lower()
    if phase in ("queued", "starting"):
        age = now - started
        if age >= WIPE_STALE_QUEUED_SEC:
            return "queued_timeout"
        return None
    last_prog = _parse_float(state.get("last_progress_at"))
    anchor = last_prog if last_prog is not None else started
    idle = now - anchor
    if last_prog is None:
        threshold = WIPE_STALE_RUNNING_SEC
    else:
        threshold = WIPE_STALE_NO_PROGRESS_SEC
        if phase == "users":
            threshold = max(WIPE_STALE_NO_PROGRESS_SEC, WIPE_STALE_USERS_SEC)
    if idle >= threshold:
        return "no_progress" if last_prog is not None else "running_timeout"
    return None


def is_wipe_stuck(state: dict) -> bool:
    """True when Redis says running but no worker is making progress."""
    return wipe_stuck_reason(state) is not None


def force_reset_wipe() -> None:
    """Clear stuck wipe flags so a new DELETE can start."""
    release_wipe_lock()
    set_wipe_in_progress(False)
    reset_wipe_state()
    try:
        from activities.wipe_tasks import _release_simulator_redis_after_wipe

        _release_simulator_redis_after_wipe()
    except Exception:
        pass
