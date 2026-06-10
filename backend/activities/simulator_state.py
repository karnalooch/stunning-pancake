"""
Redis-based Simulator State Manager
=====================================
Replaces in-process _simulation_state and _live_state dicts.
All state is stored in Redis so any WSGI worker can read/write it.
"""

import json
import os
import threading
import time
from contextlib import contextmanager
from typing import Any

from core.redis_cluster import get_redis

# Per-tick in-process cache: one HGETALL per live_tick instead of 4–6.
_live_rides_tick_cache: dict[int, dict] | None = None

REDIS_PREFIX = "sim:"

# ─── Batch Simulation State ──────────────────────────────────────

BATCH_STATE_KEY = "{sim}:batch:state"
BATCH_LOG_KEY = "{sim}:batch:log"
BATCH_LOCK_KEY = "{sim}:batch:lock"
BATCH_LOCK_TTL = 3600  # 1 hour max


def _redis_float(val) -> float | None:
    """Parse Redis hash field to float; tolerate missing/None/'None' strings."""
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() == "none":
        return None
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def _redis_int(val, default: int = 0) -> int:
    if val is None:
        return default
    s = str(val).strip()
    if not s or s.lower() == "none":
        return default
    try:
        return int(float(s))
    except (TypeError, ValueError):
        return default


def get_batch_state() -> dict:
    """Get current batch simulation state from Redis."""
    r = get_redis()
    raw = r.hgetall(BATCH_STATE_KEY)
    if not raw:
        return {
            "running": False,
            "started_at": None,
            "completed_at": None,
            "scale": 0.0,
            "days": 0,
            "error": None,
            "total_users": 0,
            "users_created": 0,
            "departments_created": 0,
            "activities_created": 0,
            "current_phase": "idle",
            "progress_pct": 0,
        }
    # Decode bytes to strings
    state = {
        k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v
        for k, v in raw.items()
    }
    # Parse numeric fields
    state["running"] = state.get("running", "false").lower() == "true"
    try:
        state["scale"] = float(state.get("scale", 0) or 0)
    except (TypeError, ValueError):
        state["scale"] = 0.0
    state["days"] = _redis_int(state.get("days"), 0)
    state["total_users"] = _redis_int(state.get("total_users"), 0)
    state["users_created"] = _redis_int(state.get("users_created"), 0)
    state["departments_created"] = _redis_int(state.get("departments_created"), 0)
    state["activities_created"] = _redis_int(state.get("activities_created"), 0)
    try:
        state["progress_pct"] = float(state.get("progress_pct", 0) or 0)
    except (TypeError, ValueError):
        state["progress_pct"] = 0.0
    state["started_at"] = _redis_float(state.get("started_at"))
    state["completed_at"] = _redis_float(state.get("completed_at"))
    err = state.get("error")
    if err is not None and str(err).strip().lower() == "none":
        state["error"] = None
    so = state.get("scale_overrides")
    if so is not None and str(so).strip().lower() in ("", "none"):
        state["scale_overrides"] = None
    return state


def set_batch_state(**kwargs):
    """Update batch simulation state fields in Redis."""
    r = get_redis()
    mapping = {k: str(v) for k, v in kwargs.items() if v is not None}
    if mapping:
        r.hset(BATCH_STATE_KEY, mapping=mapping)
    r.expire(BATCH_STATE_KEY, 86400)  # 24h TTL


def increment_batch_users_created(delta: int) -> int:
    """Atomic progress counter for parallel per-city batch workers."""
    if delta <= 0:
        try:
            return int(get_batch_state().get("users_created", 0))
        except Exception:
            return 0
    try:
        r = get_redis()
        return int(r.hincrby(BATCH_STATE_KEY, "users_created", int(delta)))
    except Exception:
        return 0


_batch_progress_pending = threading.local()
_batch_ui_last_flush = threading.local()


def _batch_progress_flush_every() -> int:
    try:
        from activities.scale_config import BATCH_PROGRESS_REDIS_EVERY

        return max(500, int(BATCH_PROGRESS_REDIS_EVERY))
    except Exception:
        return 5000


def increment_batch_users_created_throttled(delta: int) -> int:
    """
    Buffer per-worker inserts; flush to Redis in chunks (avoids HINCRBY per bulk_create row at 300k).
    """
    pending = int(getattr(_batch_progress_pending, "value", 0) or 0) + int(delta)
    flush_at = _batch_progress_flush_every()
    if pending >= flush_at:
        flushed = increment_batch_users_created(pending)
        _batch_progress_pending.value = 0
        return flushed
    _batch_progress_pending.value = pending
    try:
        return int(get_batch_state().get("users_created", 0))
    except Exception:
        return 0


def flush_batch_users_progress() -> int:
    """Flush any buffered user count (call at end of city worker)."""
    pending = int(getattr(_batch_progress_pending, "value", 0) or 0)
    if pending > 0:
        _batch_progress_pending.value = 0
        return increment_batch_users_created(pending)
    try:
        return int(get_batch_state().get("users_created", 0))
    except Exception:
        return 0


def set_batch_state_throttled(**kwargs) -> bool:
    """Rate-limit Redis HSET for progress_pct from parallel workers."""
    try:
        from activities.scale_config import BATCH_PROGRESS_UI_MIN_SECONDS

        min_interval = float(BATCH_PROGRESS_UI_MIN_SECONDS)
    except Exception:
        min_interval = 2.0

    now = time.time()
    last = float(getattr(_batch_ui_last_flush, "at", 0) or 0)
    force = kwargs.get("current_phase") in ("complete", "error") or kwargs.get("running") is False
    if not force and (now - last) < min_interval and "progress_pct" in kwargs:
        return False
    set_batch_state(**kwargs)
    _batch_ui_last_flush.at = now
    return True


def reset_batch_state():
    """Clear all batch simulation state."""
    r = get_redis()
    r.delete(BATCH_STATE_KEY, BATCH_LOG_KEY)


def batch_log(msg: str):
    """Append timestamped log line to Redis list."""
    r = get_redis()
    ts = time.strftime("%H:%M:%S")
    r.rpush(BATCH_LOG_KEY, json.dumps([ts, msg]))
    r.ltrim(BATCH_LOG_KEY, -200, -1)  # Keep last 200
    r.expire(BATCH_LOG_KEY, 86400)


def get_batch_log() -> list:
    """Get all log lines from Redis."""
    r = get_redis()
    raw = r.lrange(BATCH_LOG_KEY, 0, -1)
    lines = []
    for line in raw:
        try:
            lines.append(json.loads(line.decode() if isinstance(line, bytes) else line))
        except (json.JSONDecodeError, TypeError, ValueError):
            continue
    return lines


def acquire_batch_lock() -> bool:
    """Acquire distributed lock for batch simulation. Returns True if acquired."""
    r = get_redis()
    return bool(r.set(BATCH_LOCK_KEY, "1", nx=True, ex=BATCH_LOCK_TTL))


def release_batch_lock():
    """Release the batch simulation lock."""
    r = get_redis()
    r.delete(BATCH_LOCK_KEY)


def is_batch_lock_held() -> bool:
    r = get_redis()
    return bool(r.exists(BATCH_LOCK_KEY))


_BATCH_IDLE_PHASES = frozenset({"idle", "complete", ""})


def batch_blocks_live_simulation() -> tuple[bool, str]:
    """
    True when live sim must not start — batch still running or not fully finished.
    Uses lock + running flag + phase (parallel batch keeps lock until finalize).
    """
    if is_batch_lock_held():
        return True, "batch lock held"
    state = get_batch_state()
    if state.get("running"):
        return True, "batch running"
    phase = (state.get("current_phase") or "idle").strip().lower()
    if phase not in _BATCH_IDLE_PHASES:
        return True, f"batch phase {phase!r}"
    return False, ""


def force_stop_batch_simulation():
    """Abort batch sim and release Redis lock (safe even if already idle)."""
    set_batch_state(running=False, error=None)
    release_batch_lock()
    batch_log("⚠️ Batch stopped (locks cleared).")


# ─── Live Simulation State ──────────────────────────────────────

LIVE_STATE_KEY = "{sim}:live:state"
LIVE_LOG_KEY = "{sim}:live:log"
LIVE_LOCK_KEY = "{sim}:live:lock"
LIVE_POOL_KEY = "{sim}:live:pool"  # Redis set of user IDs (all cities)
LIVE_POOL_MODE_KEY = "{sim}:live:pool_mode"  # "redis" | "db"
LIVE_RIDES_KEY = "{sim}:live:rides"  # Redis hash of active rides


def live_pool_city_key(city_slug: str) -> str:
    return f"{{sim}}:live:pool:city:{city_slug}"


def _clear_live_city_pools(r) -> None:
    from simulate_active_cities import CITIES

    keys = [live_pool_city_key(c["slug"]) for c in CITIES]
    if keys:
        r.delete(*keys)


LIVE_TICK_LOCK_KEY = "{sim}:live:tick_lock"
LIVE_HEAL_COOLDOWN_KEY = "{sim}:live:heal_cooldown"
LIVE_LOCK_TTL = 300  # 5 min (refreshed by runner)
HEAL_COOLDOWN_SECONDS = 25

_tick_loop_stop = threading.Event()
_tick_loop_thread: threading.Thread | None = None


def get_live_state() -> dict:
    """Get current live simulation state from Redis."""
    r = get_redis()
    raw = r.hgetall(LIVE_STATE_KEY)
    if not raw:
        return {
            "running": False,
            "started_at": None,
            "error": None,
            "total_users": 0,
            "active_ratio": 0.0,
            "cheat_ratio": 0.0,
            "tick_seconds": 10,
            "currently_riding": 0,
            "total_completed": 0,
            "cheaters_caught": 0,
        }
    state = {
        k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v
        for k, v in raw.items()
    }
    state["running"] = state.get("running", "false").lower() == "true"
    state["total_users"] = _redis_int(state.get("total_users"), 0)
    try:
        state["active_ratio"] = float(state.get("active_ratio", 0) or 0)
    except (TypeError, ValueError):
        state["active_ratio"] = 0.0
    try:
        state["cheat_ratio"] = float(state.get("cheat_ratio", 0) or 0)
    except (TypeError, ValueError):
        state["cheat_ratio"] = 0.0
    state["tick_seconds"] = _redis_int(state.get("tick_seconds"), 10)
    state["currently_riding"] = int(state.get("currently_riding", 0))
    state["total_completed"] = int(state.get("total_completed", 0))
    state["cheaters_caught"] = int(state.get("cheaters_caught", 0))
    state["started_at"] = _redis_float(state.get("started_at"))
    state["last_tick_at"] = _redis_float(state.get("last_tick_at"))
    state["last_runner_at"] = _redis_float(state.get("last_runner_at"))
    err = state.get("error")
    if err is not None and str(err).strip().lower() == "none":
        state["error"] = None
    so = state.get("scale_overrides")
    if so is not None and str(so).strip().lower() in ("", "none"):
        state["scale_overrides"] = None
    return state


def set_live_state(**kwargs):
    """Update live simulation state fields in Redis."""
    r = get_redis()
    mapping = {k: str(v) for k, v in kwargs.items() if v is not None}
    if mapping:
        r.hset(LIVE_STATE_KEY, mapping=mapping)
    r.expire(LIVE_STATE_KEY, 86400)


def reset_live_state():
    """Clear all live simulation state."""
    r = get_redis()
    r.delete(LIVE_STATE_KEY, LIVE_LOG_KEY, LIVE_POOL_KEY, LIVE_POOL_MODE_KEY, LIVE_RIDES_KEY)
    _clear_live_city_pools(r)


def get_live_pool_mode() -> str:
    """redis = SRANDMEMBER pools; db = per-tick Postgres sampling (large athlete counts)."""
    r = get_redis()
    raw = r.get(LIVE_POOL_MODE_KEY)
    if not raw:
        return "redis"
    return (raw.decode() if isinstance(raw, bytes) else raw) or "redis"


def is_live_pool_db_mode() -> bool:
    return get_live_pool_mode() == "db"


def _set_live_pool_mode(mode: str) -> None:
    r = get_redis()
    if mode == "redis":
        r.delete(LIVE_POOL_MODE_KEY)
    else:
        r.set(LIVE_POOL_MODE_KEY, mode, ex=86400)


def live_log(msg: str):
    """Append timestamped log line to Redis list."""
    r = get_redis()
    ts = time.strftime("%H:%M:%S")
    r.rpush(LIVE_LOG_KEY, json.dumps([ts, msg]))
    r.ltrim(LIVE_LOG_KEY, -300, -1)
    r.expire(LIVE_LOG_KEY, 86400)


def _parse_live_log_lines(raw: list) -> list:
    lines = []
    for line in raw:
        try:
            lines.append(json.loads(line.decode() if isinstance(line, bytes) else line))
        except (json.JSONDecodeError, TypeError, ValueError):
            continue
    return lines


def get_live_log() -> list:
    """Get all log lines from Redis."""
    r = get_redis()
    return _parse_live_log_lines(r.lrange(LIVE_LOG_KEY, 0, -1))


def get_live_log_tail(limit: int = 30) -> list:
    """Tail of live sim log for lightweight status polls."""
    r = get_redis()
    n = max(1, min(int(limit), 120))
    return _parse_live_log_lines(r.lrange(LIVE_LOG_KEY, -n, -1))


def acquire_live_lock() -> bool:
    """Acquire distributed lock for live simulation."""
    r = get_redis()
    return bool(r.set(LIVE_LOCK_KEY, "1", nx=True, ex=LIVE_LOCK_TTL))


def release_live_lock():
    """Release the live simulation lock."""
    r = get_redis()
    r.delete(LIVE_LOCK_KEY)


def refresh_live_lock():
    """Extend the live simulation lock TTL."""
    r = get_redis()
    r.expire(LIVE_LOCK_KEY, LIVE_LOCK_TTL)


def is_live_lock_held() -> bool:
    r = get_redis()
    return bool(r.exists(LIVE_LOCK_KEY))


def force_stop_live_simulation():
    """Abort live sim, stop tick loop, release locks; scale OSRM down when configured."""
    from activities.railway_osrm_lifecycle import OsrmScaleResult, scale_osrm_for_live_sim

    set_live_state(running=False, error=None)
    release_live_lock()
    release_live_tick_lock()
    stop_live_tick_loop()
    osrm_scale: OsrmScaleResult | None = None
    try:
        osrm_scale = scale_osrm_for_live_sim(running=False)
        if osrm_scale.action == "scaled_down":
            live_log("OSRM Railway: scaled to 0 replicas (compute stopped).")
        elif osrm_scale.action == "failed":
            live_log(f"OSRM Railway scale-down failed: {osrm_scale.detail}")
    except Exception:
        import logging

        logging.getLogger(__name__).exception("OSRM Railway scale-down")
    live_log("⚠️ Stopped by user (locks cleared).")
    return osrm_scale


def reset_simulator_locks():
    """Emergency reset — stop flags + release batch/live locks without deleting DB."""
    force_stop_live_simulation()
    force_stop_batch_simulation()


def live_simulation_stuck() -> bool:
    """True when Redis indicates activity but running flag is off."""
    state = get_live_state()
    if state.get("running"):
        return False
    if state.get("error"):
        return True
    if is_live_lock_held():
        return True
    if get_live_rides_in_flight_count() > 0:
        return True
    if not is_live_pool_db_mode() and get_live_pool_count() > 0:
        return True
    return False


def live_tick_stale(*, multiplier: float = 4.0, min_seconds: float = 30.0) -> bool:
    """
    True when running=1 but no recent live_tick_task work (worker died, tick lock stuck, solo queue blocked).

    Uses last_tick_at only — run_live_simulation updates last_runner_at even when tick enqueue/lock fails,
    which previously masked stalled ticks behind a healthy-looking orchestrator heartbeat.

    Large on-map counts get a higher threshold so long live_tick_task runs do not spam self-heal.
    """
    state = get_live_state()
    if not state.get("running"):
        return False
    try:
        tick_seconds = float(state.get("tick_seconds", 8))
    except (ValueError, TypeError):
        tick_seconds = 8.0
    try:
        last_tick = float(state.get("last_tick_at") or 0)
    except (ValueError, TypeError):
        last_tick = 0.0
    try:
        started_at = float(state.get("started_at") or 0)
    except (ValueError, TypeError):
        started_at = 0.0
    threshold = max(min_seconds, tick_seconds * multiplier)
    try:
        on_map = int(state.get("currently_riding") or 0)
    except (TypeError, ValueError):
        on_map = 0
    try:
        in_flight = get_live_rides_in_flight_count()
    except Exception:
        in_flight = 0
    load = max(on_map, in_flight)
    try:
        per_hundred = float(os.getenv("SCALE_SIM_STALE_EXTRA_S_PER_100_RIDERS", "8"))
        cap_extra = float(os.getenv("SCALE_SIM_STALE_EXTRA_CAP_S", "120"))
    except (TypeError, ValueError):
        per_hundred, cap_extra = 8.0, 120.0
    threshold += min(cap_extra, max(0.0, load * per_hundred / 100.0))
    now = time.time()
    if last_tick > 0:
        return (now - last_tick) > threshold
    # Startup grace before the first successful tick body completes.
    grace_anchor = started_at if started_at > 0 else 0.0
    if grace_anchor <= 0:
        return True
    return (now - grace_anchor) > threshold


def _heal_cooldown_ok() -> bool:
    """Rate-limit heal+log from admin polls (avoids reschedule storms)."""
    try:
        r = get_redis()
        return bool(r.set(LIVE_HEAL_COOLDOWN_KEY, "1", nx=True, ex=HEAL_COOLDOWN_SECONDS))
    except Exception:
        return True


def heal_stale_live_simulation(*, reschedule: bool = True, from_tick_task: bool = False) -> dict:
    """
    Recover after Celery worker SIGKILL: release orphan locks, restart tick chain.
    Safe to call from status polls (idempotent). Do not pass from_tick_task=False from inside live_tick_task.
    """
    actions: list[str] = []
    state = get_live_state()
    r = get_redis()

    if not state.get("running"):
        if is_live_lock_held():
            release_live_lock()
            actions.append("released_orphan_live_lock")
        if r.exists(LIVE_TICK_LOCK_KEY):
            release_live_tick_lock()
            actions.append("released_orphan_tick_lock")
        if actions:
            live_log("Self-heal: cleared orphan live locks (sim not running).")
        return {"healed": bool(actions), "actions": actions}

    if (
        not from_tick_task
        and r.exists(LIVE_TICK_LOCK_KEY)
        and live_tick_stale(multiplier=2.0, min_seconds=20.0)
    ):
        release_live_tick_lock()
        actions.append("cleared_stale_tick_lock")

    if live_tick_stale():
        set_live_state(
            worker_recovered_at=time.time(),
            error=None,
        )
        actions.append("marked_stale_ticks")
        if reschedule and _heal_cooldown_ok():
            try:
                from activities.simulator_tasks import live_tick_task, run_live_simulation

                # Always restart the orchestrator chain (run_live_simulation self-reschedules).
                # When the live lock is still held, only live_tick_task.delay() leaves a gap
                # if the countdown chain was lost (observed ~2min stall in prod logs).
                run_live_simulation.delay()
                actions.append("rescheduled_live_runner")
                if not r.exists(LIVE_TICK_LOCK_KEY):
                    live_tick_task.delay()
                    actions.append("enqueued_live_tick")
            except Exception as exc:
                actions.append(f"reschedule_failed:{exc!s:.120}")
            live_log(
                "Self-heal: live ticks stalled (worker may have been killed); " + ", ".join(actions)
            )

    return {"healed": bool(actions), "actions": actions}


def set_live_pool(user_ids: list):
    """Set the user pool for live simulation (small pools only — prefer set_live_pool_from_db)."""
    from activities.scale_config import POOL_SADD_BATCH
    from simulate_active_cities import CITIES, resolve_city_for_user
    from users.models import User

    r = get_redis()
    r.delete(LIVE_POOL_KEY)
    _clear_live_city_pools(r)
    if not user_ids:
        return
    users = User.objects.filter(id__in=user_ids).select_related("tenant")
    by_city: dict[str, list[str]] = {c["slug"]: [] for c in CITIES}
    for user in users:
        slug = resolve_city_for_user(user)["slug"]
        by_city.setdefault(slug, []).append(str(user.id))
    for slug, ids in by_city.items():
        if not ids:
            continue
        city_key = live_pool_city_key(slug)
        for i in range(0, len(ids), POOL_SADD_BATCH):
            chunk = ids[i : i + POOL_SADD_BATCH]
            r.sadd(LIVE_POOL_KEY, *chunk)
            r.sadd(city_key, *chunk)


def _sadd_pool_batches(r, global_batch: list[str], city_batches: dict[str, list[str]]) -> None:
    from activities.scale_config import POOL_SADD_BATCH

    if global_batch:
        for i in range(0, len(global_batch), POOL_SADD_BATCH):
            r.sadd(LIVE_POOL_KEY, *global_batch[i : i + POOL_SADD_BATCH])
    for slug, ids in city_batches.items():
        if not ids:
            continue
        city_key = live_pool_city_key(slug)
        for i in range(0, len(ids), POOL_SADD_BATCH):
            r.sadd(city_key, *ids[i : i + POOL_SADD_BATCH])


def init_live_pool_db_mode(pool_target: int) -> int:
    """
    Large-scale live sim: no Redis SET of all athlete IDs.
    Ticks sample per city via Postgres (order_by('?')[:n]).
    """
    from activities.scale_config import MAX_LIVE_POOL
    from users.models import User

    r = get_redis()
    r.delete(LIVE_POOL_KEY)
    _clear_live_city_pools(r)
    _set_live_pool_mode("db")

    athlete_count = User.objects.filter(role="ATHLETE").count()
    logical = min(int(pool_target), MAX_LIVE_POOL, athlete_count)
    return logical


def _athlete_qs_for_city(city: dict, tenant_id: int | None):
    from users.models import User

    slug = city["slug"]
    qs = User.objects.filter(role="ATHLETE")
    if tenant_id:
        return qs.filter(tenant_id=tenant_id)
    return qs.filter(username__startswith=f"{slug}_athlete_")


def sample_live_athletes_from_db(city_slug: str, count: int) -> list[int]:
    """Random athletes for one city — bounded query, no full-table scan."""
    from simulate_active_cities import CITIES
    from users.models import Tenant

    count = max(0, int(count))
    if count == 0:
        return []
    city = next((c for c in CITIES if c["slug"] == city_slug), None)
    if not city:
        return []
    tenant_id = Tenant.objects.filter(name=city["name"]).values_list("id", flat=True).first()
    qs = _athlete_qs_for_city(city, tenant_id)
    return list(qs.order_by("?").values_list("id", flat=True)[:count])


def set_live_pool_from_db(limit: int) -> int:
    """
    Load athlete IDs into Redis per city — bounded [:quota] queries only (no table iterator).
    Large targets use DB sampling mode via live_pool_mode_for_target.
    """
    from activities.scale_config import (
        POOL_SADD_BATCH,
        effective_redis_pool_limit,
        live_pool_mode_for_target,
    )
    from simulate_active_cities import CITIES
    from users.models import Tenant

    pool_target = int(limit)
    if live_pool_mode_for_target(pool_target) == "db":
        return init_live_pool_db_mode(pool_target)

    limit = effective_redis_pool_limit(pool_target)
    r = get_redis()
    r.delete(LIVE_POOL_KEY)
    _clear_live_city_pools(r)
    _set_live_pool_mode("redis")

    city_names = [c["name"] for c in CITIES]
    tenants = {t.name: t.id for t in Tenant.objects.filter(name__in=city_names)}
    cities = [c for c in CITIES if c["name"] in tenants] or list(CITIES)
    n = max(1, len(cities))
    per_city = max(1, limit // n)
    remainder = limit
    global_batch: list[str] = []
    city_batches: dict[str, list[str]] = {c["slug"]: [] for c in cities}

    for i, city in enumerate(cities):
        quota = per_city if i < n - 1 else remainder
        remainder -= quota
        if quota <= 0:
            continue
        slug = city["slug"]
        tenant_id = tenants.get(city["name"])
        qs = _athlete_qs_for_city(city, tenant_id)
        ids = list(qs.order_by("?").values_list("id", flat=True)[:quota])
        for uid in ids:
            sid = str(uid)
            global_batch.append(sid)
            city_batches[slug].append(sid)
            if len(global_batch) >= POOL_SADD_BATCH:
                _sadd_pool_batches(r, global_batch, city_batches)
                global_batch = []
                city_batches = {c["slug"]: [] for c in cities}

    if global_batch:
        _sadd_pool_batches(r, global_batch, city_batches)

    return int(r.scard(LIVE_POOL_KEY) or 0)


def get_live_pool_count() -> int:
    """Pool size without SMEMBERS. In db mode, returns logical pool from live state."""
    if is_live_pool_db_mode():
        try:
            return int(get_live_state().get("total_users", 0))
        except Exception:
            return 0
    r = get_redis()
    return int(r.scard(LIVE_POOL_KEY) or 0)


def sample_live_pool(count: int) -> list[int]:
    """Random sample of pool members — O(count), not O(pool size)."""
    r = get_redis()
    count = max(0, int(count))
    if count == 0:
        return []
    raw = r.srandmember(LIVE_POOL_KEY, count)
    if raw is None:
        return []
    if isinstance(raw, (bytes, str)):
        raw = [raw]
    return [int(uid.decode() if isinstance(uid, bytes) else uid) for uid in raw]


def sample_live_pool_city(city_slug: str, count: int) -> list[int]:
    """Random sample from one city's pool slice."""
    r = get_redis()
    count = max(0, int(count))
    if count == 0:
        return []
    raw = r.srandmember(live_pool_city_key(city_slug), count)
    if raw is None:
        return []
    if isinstance(raw, (bytes, str)):
        raw = [raw]
    return [int(uid.decode() if isinstance(uid, bytes) else uid) for uid in raw]


def get_live_pool() -> list:
    """Get all user IDs in the live pool. Avoid when pool > ~10k — use sample_live_pool."""
    r = get_redis()
    raw = r.smembers(LIVE_POOL_KEY)
    return [int(uid.decode() if isinstance(uid, bytes) else uid) for uid in raw]


def remove_from_live_pool(user_ids: list):
    """Remove user IDs from the live pool."""
    r = get_redis()
    if user_ids:
        r.srem(LIVE_POOL_KEY, *[str(uid) for uid in user_ids])


def _load_live_rides_from_redis() -> dict[int, dict]:
    r = get_redis()
    raw = r.hgetall(LIVE_RIDES_KEY)
    rides: dict[int, dict] = {}
    for user_id, ride_json in raw.items():
        uid = int(user_id.decode() if isinstance(user_id, bytes) else user_id)
        ride_data = json.loads(ride_json.decode() if isinstance(ride_json, bytes) else ride_json)
        rides[uid] = ride_data
    return rides


def begin_live_rides_tick_cache() -> dict[int, dict]:
    """Load live_rides once for the current live_tick (simulation worker)."""
    global _live_rides_tick_cache
    _live_rides_tick_cache = _load_live_rides_from_redis()
    return _live_rides_tick_cache


def end_live_rides_tick_cache() -> None:
    global _live_rides_tick_cache
    _live_rides_tick_cache = None


@contextmanager
def live_rides_tick_cache():
    begin_live_rides_tick_cache()
    try:
        yield
    finally:
        end_live_rides_tick_cache()


def get_live_ride(user_id: int) -> dict | None:
    """Single ride — used by routing worker (no full-hash scan)."""
    global _live_rides_tick_cache
    uid = int(user_id)
    if _live_rides_tick_cache is not None:
        return _live_rides_tick_cache.get(uid)
    r = get_redis()
    raw = r.hget(LIVE_RIDES_KEY, str(uid))
    if not raw:
        return None
    return json.loads(raw.decode() if isinstance(raw, bytes) else raw)


def get_live_rides(*, force_refresh: bool = False) -> dict[int, dict]:
    """Get all active rides; uses tick cache when inside live_tick."""
    global _live_rides_tick_cache
    if not force_refresh and _live_rides_tick_cache is not None:
        return _live_rides_tick_cache
    return _load_live_rides_from_redis()


def set_live_ride(user_id: int, ride_data: dict):
    """Set a single ride in the Redis hash."""
    global _live_rides_tick_cache
    r = get_redis()
    r.hset(LIVE_RIDES_KEY, str(user_id), json.dumps(ride_data))
    if _live_rides_tick_cache is not None:
        _live_rides_tick_cache[int(user_id)] = ride_data


def delete_live_ride(user_id: int):
    """Delete a ride from the Redis hash."""
    global _live_rides_tick_cache
    r = get_redis()
    r.hdel(LIVE_RIDES_KEY, str(user_id))
    if _live_rides_tick_cache is not None:
        _live_rides_tick_cache.pop(int(user_id), None)


def fsm_snapshot_fresh(state: dict | None, *, multiplier: float = 2.5) -> bool:
    """True when tick-persisted FSM counters are recent enough for status/map reads."""
    if not state or not state.get("running"):
        return False
    last = _redis_float(state.get("last_tick_at"))
    if last is None:
        return False
    try:
        tick_s = float(state.get("tick_seconds", 8) or 8)
    except (TypeError, ValueError):
        tick_s = 8.0
    return (time.time() - last) <= max(12.0, tick_s * multiplier)


def persist_live_fsm_snapshot(
    fsm: dict[str, int],
    city_counts: dict[str, int] | None = None,
    *,
    city_bike_counts: dict[str, int] | None = None,
    city_run_counts: dict[str, int] | None = None,
) -> None:
    """Store FSM aggregates on live state — avoids HGETALL on admin status polls."""
    payload: dict[str, Any] = {
        "fsm_ride_pending_route": int(fsm.get("ride_pending_route", 0)),
        "fsm_ride_routing": int(fsm.get("ride_routing", 0)),
        "fsm_ride_routed": int(fsm.get("ride_routed", 0)),
        "fsm_ride_active": int(fsm.get("ride_active", 0)),
        "fsm_ride_warming": int(fsm.get("ride_warming", 0)),
        "fsm_ride_on_map": int(fsm.get("ride_on_map", 0)),
        "fsm_snapshot_at": time.time(),
    }
    if city_counts is not None:
        state = get_live_state()
        prev_raw = state.get("fsm_city_counts")
        if prev_raw:
            payload["fsm_city_counts_prev"] = prev_raw
        payload["fsm_city_counts"] = json.dumps(city_counts, sort_keys=True)
    if city_bike_counts is not None:
        payload["fsm_city_bike_counts"] = json.dumps(city_bike_counts, sort_keys=True)
    if city_run_counts is not None:
        payload["fsm_city_run_counts"] = json.dumps(city_run_counts, sort_keys=True)
    set_live_state(**payload)


def fsm_summary_from_state(state: dict) -> dict[str, int] | None:
    if not fsm_snapshot_fresh(state):
        return None
    try:
        return {
            "ride_pending_route": _redis_int(state.get("fsm_ride_pending_route"), 0),
            "ride_routing": _redis_int(state.get("fsm_ride_routing"), 0),
            "ride_routed": _redis_int(state.get("fsm_ride_routed"), 0),
            "ride_active": _redis_int(state.get("fsm_ride_active"), 0),
            "ride_warming": _redis_int(state.get("fsm_ride_warming"), 0),
            "ride_on_map": _redis_int(state.get("fsm_ride_on_map"), 0),
            "ride_failed_unroutable": 0,
        }
    except Exception:
        return None


def get_live_fsm_summary() -> dict[str, int]:
    """FSM for status/API: Redis snapshot when fresh, else one HGETALL."""
    from activities.ride_fsm import fsm_summary

    state = get_live_state()
    cached = fsm_summary_from_state(state)
    if cached is not None:
        return cached
    return fsm_summary(get_live_rides())


def requeue_stale_routing_rides(
    *,
    max_age_seconds: float = 90,
    rides: dict[int, dict] | None = None,
) -> int:
    """
    Recover rides stuck in ROUTING after worker loss or hung BRouter HTTP.
    Without routing_since (legacy rows), requeue immediately.
    """
    from activities.ride_fsm import PENDING_ROUTE, ROUTING, normalize_ride_state

    now = time.time()
    requeued = 0
    for uid, ride in (rides if rides is not None else get_live_rides()).items():
        if normalize_ride_state(ride) != ROUTING:
            continue
        since = ride.get("routing_since")
        if since is not None:
            try:
                age = now - float(since)
            except (TypeError, ValueError):
                age = max_age_seconds + 1.0
            if age <= max_age_seconds:
                continue
        set_live_ride(
            uid,
            {**ride, "ride_state": PENDING_ROUTE, "routing_since": None},
        )
        requeued += 1
    return requeued


def get_live_rides_in_flight_count() -> int:
    """All entries in the live rides hash (ACTIVE + warming/routing pipeline)."""
    r = get_redis()
    return r.hlen(LIVE_RIDES_KEY)


def get_live_ride_count(*, active_only: bool = True) -> int:
    """
    Ride counts for admin/map KPIs.

    Default (active_only=True): ACTIVE rides only — matches telemetry_eligible / ride_on_map.
    active_only=False: full hash length — concurrency / stuck detection.
    """
    if not active_only:
        return get_live_rides_in_flight_count()
    state = get_live_state()
    if fsm_snapshot_fresh(state):
        on_map = _redis_int(state.get("fsm_ride_on_map"), -1)
        if on_map >= 0:
            return on_map
    from activities.ride_fsm import telemetry_eligible

    return sum(1 for ride in get_live_rides().values() if telemetry_eligible(ride))


def get_live_city_counts() -> dict[str, int]:
    """Active riders per simulator city (for live-map overview badges)."""
    activity = get_live_city_activity_counts()
    return {slug: int(v.get("total", 0)) for slug, v in activity.items()}


def get_live_city_activity_counts() -> dict[str, dict[str, int]]:
    """Per-city bike/run/total counts for live-map macro hubs."""
    from simulate_active_cities import CITIES

    empty = {c["slug"]: {"bike": 0, "run": 0, "total": 0} for c in CITIES}
    state = get_live_state()
    if fsm_snapshot_fresh(state):
        raw_bike = state.get("fsm_city_bike_counts")
        raw_run = state.get("fsm_city_run_counts")
        if raw_bike and raw_run:
            try:
                bike_parsed = json.loads(raw_bike)
                run_parsed = json.loads(raw_run)
                if isinstance(bike_parsed, dict) and isinstance(run_parsed, dict):
                    out = {slug: {"bike": 0, "run": 0, "total": 0} for slug in empty}
                    for slug in out:
                        bike_n = int(bike_parsed.get(slug, 0) or 0)
                        run_n = int(run_parsed.get(slug, 0) or 0)
                        out[slug] = {"bike": bike_n, "run": run_n, "total": bike_n + run_n}
                    return out
            except (json.JSONDecodeError, TypeError, ValueError):
                pass

    from activities.ride_fsm import telemetry_eligible

    counts = {slug: {"bike": 0, "run": 0, "total": 0} for slug in empty}
    for ride in get_live_rides().values():
        if not telemetry_eligible(ride):
            continue
        slug = ride.get("city_slug") or ""
        if slug not in counts:
            continue
        act = str(ride.get("act_type", "BIKE") or "BIKE").upper()
        if act == "RUN":
            counts[slug]["run"] += 1
        else:
            counts[slug]["bike"] += 1
        counts[slug]["total"] += 1
    return counts


def get_live_city_trend() -> dict[str, int]:
    """Delta active riders per city vs previous FSM snapshot."""
    from simulate_active_cities import CITIES

    state = get_live_state()
    current = get_live_city_counts()
    prev: dict[str, int] = {c["slug"]: 0 for c in CITIES}
    raw_prev = state.get("fsm_city_counts_prev")
    if raw_prev:
        try:
            parsed = json.loads(raw_prev)
            if isinstance(parsed, dict):
                for slug in prev:
                    prev[slug] = int(parsed.get(slug, 0) or 0)
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    return {slug: int(current.get(slug, 0)) - prev.get(slug, 0) for slug in prev}


def get_flagged_live_device_ids() -> list[str]:
    """Simulator cheater rides currently on map (deviceId = user id)."""
    from activities.ride_fsm import telemetry_eligible

    flagged: list[str] = []
    for uid, ride in get_live_rides().items():
        if not telemetry_eligible(ride):
            continue
        if ride.get("is_cheater"):
            flagged.append(str(uid))
    return flagged


def increment_live_routing_counter(field: str, delta: int = 1) -> int:
    """Cumulative routing metrics on live state hash (unroutable vs transport errors)."""
    if delta <= 0:
        return _redis_int(get_live_state().get(field), 0)
    try:
        r = get_redis()
        return int(r.hincrby(LIVE_STATE_KEY, field, int(delta)))
    except Exception:
        return 0


# ─── Validation ──────────────────────────────────────────────────


def live_tick_lock_ttl_seconds() -> int:
    """Scale lock TTL with pipeline depth so long ticks are not interrupted mid-flight."""
    try:
        in_flight = get_live_rides_in_flight_count()
    except Exception:
        in_flight = 0
    try:
        base = int(os.getenv("SCALE_SIM_LIVE_TICK_LOCK_TTL", "120"))
    except (TypeError, ValueError):
        base = 120
    return min(600, max(30, base + in_flight // 15))


_TICK_LOCK_SKIP_LOG_KEY = "{sim}:live:tick_lock_skip_log"
_TICK_LOCK_SKIP_LOG_INTERVAL_S = 30.0


def maybe_log_live_tick_lock_skip() -> None:
    """Rate-limited visibility when ticks are skipped due to lock contention."""
    try:
        r = get_redis()
        if not r.set(_TICK_LOCK_SKIP_LOG_KEY, "1", nx=True, ex=int(_TICK_LOCK_SKIP_LOG_INTERVAL_S)):
            return
    except Exception:
        pass
    live_log("Live tick skipped: tick lock held (another tick running or stale lock).")


def acquire_live_tick_lock() -> bool:
    """Prevent overlapping ticks when poll endpoints and background loop fire together."""
    r = get_redis()
    return bool(r.set(LIVE_TICK_LOCK_KEY, "1", nx=True, ex=live_tick_lock_ttl_seconds()))


def refresh_live_tick_lock() -> None:
    try:
        r = get_redis()
        if r.exists(LIVE_TICK_LOCK_KEY):
            r.expire(LIVE_TICK_LOCK_KEY, live_tick_lock_ttl_seconds())
    except Exception:
        pass


def release_live_tick_lock():
    r = get_redis()
    r.delete(LIVE_TICK_LOCK_KEY)


LIVE_POLL_ADVANCE_GATE_KEY = "{sim}:live:poll_advance_gate"
LIVE_POLL_ADVANCE_GATE_SEC = 2


def maybe_advance_live_simulation_from_poll() -> bool:
    """
    Rate-limit tick enqueue from hot telemetry polls (avoids heal/tick storms per pan).
    Admin actions should call maybe_advance_live_simulation() directly.
    """
    try:
        r = get_redis()
        if not r.set(LIVE_POLL_ADVANCE_GATE_KEY, "1", nx=True, ex=LIVE_POLL_ADVANCE_GATE_SEC):
            return False
    except Exception:
        pass
    return maybe_advance_live_simulation()


def maybe_advance_live_simulation() -> bool:
    """Trigger a live sim tick if the interval elapsed. Safe from any poll endpoint."""
    state = get_live_state()
    if not state.get("running"):
        return False

    if live_tick_stale():
        heal_stale_live_simulation(reschedule=True)
        state = get_live_state()

    now = time.time()
    try:
        last_tick = float(state.get("last_tick_at") or 0)
    except (ValueError, TypeError):
        last_tick = 0.0
    try:
        tick_seconds = float(state.get("tick_seconds", 8))
    except (ValueError, TypeError):
        tick_seconds = 8.0
    if now - last_tick < tick_seconds:
        return False
    # Do not bump last_tick_at here — only live_tick_task / runner after real work.
    # Premature updates caused ~0.01s "ticks" with zero riders when enqueue failed or lock busy.
    from activities.simulator_tasks import live_tick_task

    live_tick_task.delay()
    return True


def start_live_tick_loop():
    """Background tick loop for SQLite/local dev (Celery eager ignores countdown)."""
    global _tick_loop_thread
    stop_live_tick_loop()
    _tick_loop_stop.clear()

    def _loop():
        while not _tick_loop_stop.is_set():
            if not get_live_state().get("running"):
                break
            try:
                tick_seconds = max(2, int(get_live_state().get("tick_seconds", 8)))
            except (ValueError, TypeError):
                tick_seconds = 8
            if _tick_loop_stop.wait(tick_seconds):
                break
            if not get_live_state().get("running"):
                break
            from activities.simulator_tasks import live_tick_task

            try:
                live_tick_task()
            except Exception:
                pass

    _tick_loop_thread = threading.Thread(target=_loop, daemon=True, name="live-sim-tick")
    _tick_loop_thread.start()


def stop_live_tick_loop():
    _tick_loop_stop.set()


def validate_athlete_pool(min_users: int = 10) -> dict:
    """Pre-flight check: count available ATHLETE users."""
    from users.models import User

    count = User.objects.filter(role="ATHLETE").count()
    return {
        "has_athletes": count >= min_users,
        "athlete_count": count,
        "min_required": min_users,
        "error": None
        if count >= min_users
        else f"Only {count} ATHLETE users found (need {min_users}). Run batch generator first.",
    }
