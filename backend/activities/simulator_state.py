"""
Redis-based Simulator State Manager
=====================================
Replaces in-process _simulation_state and _live_state dicts.
All state is stored in Redis so any WSGI worker can read/write it.
"""
import json
import threading
import time
from typing import Any

from core.redis_cluster import get_redis

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
    if not s or s.lower() == 'none':
        return None
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def _redis_int(val, default: int = 0) -> int:
    if val is None:
        return default
    s = str(val).strip()
    if not s or s.lower() == 'none':
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
            'running': False, 'started_at': None, 'completed_at': None,
            'scale': 0.0, 'days': 0, 'error': None, 'total_users': 0,
            'users_created': 0, 'departments_created': 0, 'activities_created': 0,
            'current_phase': 'idle', 'progress_pct': 0,
        }
    # Decode bytes to strings
    state = {k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v for k, v in raw.items()}
    # Parse numeric fields
    state['running'] = state.get('running', 'false').lower() == 'true'
    try:
        state['scale'] = float(state.get('scale', 0) or 0)
    except (TypeError, ValueError):
        state['scale'] = 0.0
    state['days'] = _redis_int(state.get('days'), 0)
    state['total_users'] = _redis_int(state.get('total_users'), 0)
    state['users_created'] = _redis_int(state.get('users_created'), 0)
    state['departments_created'] = _redis_int(state.get('departments_created'), 0)
    state['activities_created'] = _redis_int(state.get('activities_created'), 0)
    try:
        state['progress_pct'] = float(state.get('progress_pct', 0) or 0)
    except (TypeError, ValueError):
        state['progress_pct'] = 0.0
    state['started_at'] = _redis_float(state.get('started_at'))
    state['completed_at'] = _redis_float(state.get('completed_at'))
    err = state.get('error')
    if err is not None and str(err).strip().lower() == 'none':
        state['error'] = None
    so = state.get('scale_overrides')
    if so is not None and str(so).strip().lower() in ('', 'none'):
        state['scale_overrides'] = None
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
            return int(get_batch_state().get('users_created', 0))
        except Exception:
            return 0
    try:
        r = get_redis()
        return int(r.hincrby(BATCH_STATE_KEY, 'users_created', int(delta)))
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
    pending = int(getattr(_batch_progress_pending, 'value', 0) or 0) + int(delta)
    flush_at = _batch_progress_flush_every()
    if pending >= flush_at:
        flushed = increment_batch_users_created(pending)
        _batch_progress_pending.value = 0
        return flushed
    _batch_progress_pending.value = pending
    try:
        return int(get_batch_state().get('users_created', 0))
    except Exception:
        return 0


def flush_batch_users_progress() -> int:
    """Flush any buffered user count (call at end of city worker)."""
    pending = int(getattr(_batch_progress_pending, 'value', 0) or 0)
    if pending > 0:
        _batch_progress_pending.value = 0
        return increment_batch_users_created(pending)
    try:
        return int(get_batch_state().get('users_created', 0))
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
    last = float(getattr(_batch_ui_last_flush, 'at', 0) or 0)
    force = kwargs.get('current_phase') in ('complete', 'error') or kwargs.get('running') is False
    if not force and (now - last) < min_interval and 'progress_pct' in kwargs:
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
    ts = time.strftime('%H:%M:%S')
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


_BATCH_IDLE_PHASES = frozenset({'idle', 'complete', ''})


def batch_blocks_live_simulation() -> tuple[bool, str]:
    """
    True when live sim must not start — batch still running or not fully finished.
    Uses lock + running flag + phase (parallel batch keeps lock until finalize).
    """
    if is_batch_lock_held():
        return True, 'batch lock held'
    state = get_batch_state()
    if state.get('running'):
        return True, 'batch running'
    phase = (state.get('current_phase') or 'idle').strip().lower()
    if phase not in _BATCH_IDLE_PHASES:
        return True, f'batch phase {phase!r}'
    return False, ''


def force_stop_batch_simulation():
    """Abort batch sim and release Redis lock (safe even if already idle)."""
    set_batch_state(running=False, error=None)
    release_batch_lock()
    batch_log("⚠️ Batch stopped (locks cleared).")


# ─── Live Simulation State ──────────────────────────────────────

LIVE_STATE_KEY = "{sim}:live:state"
LIVE_LOG_KEY = "{sim}:live:log"
LIVE_LOCK_KEY = "{sim}:live:lock"
LIVE_POOL_KEY = "{sim}:live:pool"       # Redis set of user IDs (all cities)
LIVE_POOL_MODE_KEY = "{sim}:live:pool_mode"  # "redis" | "db"
LIVE_RIDES_KEY = "{sim}:live:rides"     # Redis hash of active rides


def live_pool_city_key(city_slug: str) -> str:
    return f"{{sim}}:live:pool:city:{city_slug}"


def _clear_live_city_pools(r) -> None:
    from simulate_active_cities import CITIES
    keys = [live_pool_city_key(c['slug']) for c in CITIES]
    if keys:
        r.delete(*keys)
LIVE_TICK_LOCK_KEY = "{sim}:live:tick_lock"
LIVE_LOCK_TTL = 300  # 5 min (refreshed by runner)

_tick_loop_stop = threading.Event()
_tick_loop_thread: threading.Thread | None = None


def get_live_state() -> dict:
    """Get current live simulation state from Redis."""
    r = get_redis()
    raw = r.hgetall(LIVE_STATE_KEY)
    if not raw:
        return {
            'running': False, 'started_at': None, 'error': None,
            'total_users': 0, 'active_ratio': 0.0, 'cheat_ratio': 0.0,
            'tick_seconds': 10, 'currently_riding': 0, 'total_completed': 0,
            'cheaters_caught': 0,
        }
    state = {k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v for k, v in raw.items()}
    state['running'] = state.get('running', 'false').lower() == 'true'
    state['total_users'] = _redis_int(state.get('total_users'), 0)
    try:
        state['active_ratio'] = float(state.get('active_ratio', 0) or 0)
    except (TypeError, ValueError):
        state['active_ratio'] = 0.0
    try:
        state['cheat_ratio'] = float(state.get('cheat_ratio', 0) or 0)
    except (TypeError, ValueError):
        state['cheat_ratio'] = 0.0
    state['tick_seconds'] = _redis_int(state.get('tick_seconds'), 10)
    state['currently_riding'] = int(state.get('currently_riding', 0))
    state['total_completed'] = int(state.get('total_completed', 0))
    state['cheaters_caught'] = int(state.get('cheaters_caught', 0))
    state['started_at'] = _redis_float(state.get('started_at'))
    state['last_tick_at'] = _redis_float(state.get('last_tick_at'))
    err = state.get('error')
    if err is not None and str(err).strip().lower() == 'none':
        state['error'] = None
    so = state.get('scale_overrides')
    if so is not None and str(so).strip().lower() in ('', 'none'):
        state['scale_overrides'] = None
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
        return 'redis'
    return (raw.decode() if isinstance(raw, bytes) else raw) or 'redis'


def is_live_pool_db_mode() -> bool:
    return get_live_pool_mode() == 'db'


def _set_live_pool_mode(mode: str) -> None:
    r = get_redis()
    if mode == 'redis':
        r.delete(LIVE_POOL_MODE_KEY)
    else:
        r.set(LIVE_POOL_MODE_KEY, mode, ex=86400)


def live_log(msg: str):
    """Append timestamped log line to Redis list."""
    r = get_redis()
    ts = time.strftime('%H:%M:%S')
    r.rpush(LIVE_LOG_KEY, json.dumps([ts, msg]))
    r.ltrim(LIVE_LOG_KEY, -300, -1)
    r.expire(LIVE_LOG_KEY, 86400)


def get_live_log() -> list:
    """Get all log lines from Redis."""
    r = get_redis()
    raw = r.lrange(LIVE_LOG_KEY, 0, -1)
    lines = []
    for line in raw:
        try:
            lines.append(json.loads(line.decode() if isinstance(line, bytes) else line))
        except (json.JSONDecodeError, TypeError, ValueError):
            continue
    return lines


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
    """Abort live sim, stop tick loop, and release all live locks."""
    set_live_state(running=False, error=None)
    release_live_lock()
    release_live_tick_lock()
    stop_live_tick_loop()
    live_log("⚠️ Stopped by user (locks cleared).")


def reset_simulator_locks():
    """Emergency reset — stop flags + release batch/live locks without deleting DB."""
    force_stop_live_simulation()
    force_stop_batch_simulation()


def live_simulation_stuck() -> bool:
    """True when Redis indicates activity but running flag is off."""
    state = get_live_state()
    if state.get('running'):
        return False
    if state.get('error'):
        return True
    if is_live_lock_held():
        return True
    if get_live_ride_count() > 0:
        return True
    if not is_live_pool_db_mode() and get_live_pool_count() > 0:
        return True
    return False


def live_tick_stale(*, multiplier: float = 4.0, min_seconds: float = 30.0) -> bool:
    """True when running=1 but no successful tick for several intervals (worker died / lock skip)."""
    state = get_live_state()
    if not state.get('running'):
        return False
    try:
        tick_seconds = float(state.get('tick_seconds', 8))
    except (ValueError, TypeError):
        tick_seconds = 8.0
    try:
        last_tick = float(state.get('last_tick_at') or 0)
    except (ValueError, TypeError):
        last_tick = 0.0
    if last_tick <= 0:
        return True
    threshold = max(min_seconds, tick_seconds * multiplier)
    return (time.time() - last_tick) > threshold


def heal_stale_live_simulation(*, reschedule: bool = True, from_tick_task: bool = False) -> dict:
    """
    Recover after Celery worker SIGKILL: release orphan locks, restart tick chain.
    Safe to call from status polls (idempotent). Do not pass from_tick_task=False from inside live_tick_task.
    """
    actions: list[str] = []
    state = get_live_state()
    r = get_redis()

    if not state.get('running'):
        if is_live_lock_held():
            release_live_lock()
            actions.append('released_orphan_live_lock')
        if r.exists(LIVE_TICK_LOCK_KEY):
            release_live_tick_lock()
            actions.append('released_orphan_tick_lock')
        if actions:
            live_log('Self-heal: cleared orphan live locks (sim not running).')
        return {'healed': bool(actions), 'actions': actions}

    if (
        not from_tick_task
        and r.exists(LIVE_TICK_LOCK_KEY)
        and live_tick_stale(multiplier=2.0, min_seconds=20.0)
    ):
        release_live_tick_lock()
        actions.append('cleared_stale_tick_lock')

    if live_tick_stale():
        set_live_state(
            worker_recovered_at=time.time(),
            error=None,
        )
        actions.append('marked_stale_ticks')
        if reschedule:
            try:
                from activities.simulator_tasks import live_tick_task, run_live_simulation

                if is_live_lock_held():
                    live_tick_task.delay()
                    actions.append('rescheduled_live_tick')
                else:
                    run_live_simulation.delay()
                    actions.append('rescheduled_live_runner')
            except Exception as exc:
                actions.append(f'reschedule_failed:{exc!s:.120}')
        live_log(
            'Self-heal: live ticks stalled (worker may have been killed); '
            + ', '.join(actions)
        )

    return {'healed': bool(actions), 'actions': actions}


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
    users = User.objects.filter(id__in=user_ids).select_related('tenant')
    by_city: dict[str, list[str]] = {c['slug']: [] for c in CITIES}
    for user in users:
        slug = resolve_city_for_user(user)['slug']
        by_city.setdefault(slug, []).append(str(user.id))
    for slug, ids in by_city.items():
        if not ids:
            continue
        city_key = live_pool_city_key(slug)
        for i in range(0, len(ids), POOL_SADD_BATCH):
            chunk = ids[i:i + POOL_SADD_BATCH]
            r.sadd(LIVE_POOL_KEY, *chunk)
            r.sadd(city_key, *chunk)


def _sadd_pool_batches(r, global_batch: list[str], city_batches: dict[str, list[str]]) -> None:
    from activities.scale_config import POOL_SADD_BATCH

    if global_batch:
        for i in range(0, len(global_batch), POOL_SADD_BATCH):
            r.sadd(LIVE_POOL_KEY, *global_batch[i:i + POOL_SADD_BATCH])
    for slug, ids in city_batches.items():
        if not ids:
            continue
        city_key = live_pool_city_key(slug)
        for i in range(0, len(ids), POOL_SADD_BATCH):
            r.sadd(city_key, *ids[i:i + POOL_SADD_BATCH])


def init_live_pool_db_mode(pool_target: int) -> int:
    """
    Large-scale live sim: no Redis SET of all athlete IDs.
    Ticks sample per city via Postgres (order_by('?')[:n]).
    """
    from users.models import User
    from activities.scale_config import MAX_LIVE_POOL

    r = get_redis()
    r.delete(LIVE_POOL_KEY)
    _clear_live_city_pools(r)
    _set_live_pool_mode('db')

    athlete_count = User.objects.filter(role='ATHLETE').count()
    logical = min(int(pool_target), MAX_LIVE_POOL, athlete_count)
    return logical


def _athlete_qs_for_city(city: dict, tenant_id: int | None):
    from users.models import User

    slug = city['slug']
    qs = User.objects.filter(role='ATHLETE')
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
    city = next((c for c in CITIES if c['slug'] == city_slug), None)
    if not city:
        return []
    tenant_id = Tenant.objects.filter(name=city['name']).values_list('id', flat=True).first()
    qs = _athlete_qs_for_city(city, tenant_id)
    return list(qs.order_by('?').values_list('id', flat=True)[:count])


def set_live_pool_from_db(limit: int) -> int:
    """
    Load athlete IDs into Redis per city — bounded [:quota] queries only (no table iterator).
    Large targets use DB sampling mode via live_pool_mode_for_target.
    """
    from users.models import Tenant
    from simulate_active_cities import CITIES
    from activities.scale_config import (
        POOL_SADD_BATCH,
        effective_redis_pool_limit,
        live_pool_mode_for_target,
    )

    pool_target = int(limit)
    if live_pool_mode_for_target(pool_target) == 'db':
        return init_live_pool_db_mode(pool_target)

    limit = effective_redis_pool_limit(pool_target)
    r = get_redis()
    r.delete(LIVE_POOL_KEY)
    _clear_live_city_pools(r)
    _set_live_pool_mode('redis')

    city_names = [c['name'] for c in CITIES]
    tenants = {t.name: t.id for t in Tenant.objects.filter(name__in=city_names)}
    cities = [c for c in CITIES if c['name'] in tenants] or list(CITIES)
    n = max(1, len(cities))
    per_city = max(1, limit // n)
    remainder = limit
    global_batch: list[str] = []
    city_batches: dict[str, list[str]] = {c['slug']: [] for c in cities}

    for i, city in enumerate(cities):
        quota = per_city if i < n - 1 else remainder
        remainder -= quota
        if quota <= 0:
            continue
        slug = city['slug']
        tenant_id = tenants.get(city['name'])
        qs = _athlete_qs_for_city(city, tenant_id)
        ids = list(qs.order_by('?').values_list('id', flat=True)[:quota])
        for uid in ids:
            sid = str(uid)
            global_batch.append(sid)
            city_batches[slug].append(sid)
            if len(global_batch) >= POOL_SADD_BATCH:
                _sadd_pool_batches(r, global_batch, city_batches)
                global_batch = []
                city_batches = {c['slug']: [] for c in cities}

    if global_batch:
        _sadd_pool_batches(r, global_batch, city_batches)

    return int(r.scard(LIVE_POOL_KEY) or 0)


def get_live_pool_count() -> int:
    """Pool size without SMEMBERS. In db mode, returns logical pool from live state."""
    if is_live_pool_db_mode():
        try:
            return int(get_live_state().get('total_users', 0))
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


def get_live_rides() -> dict:
    """Get all active rides from Redis hash."""
    r = get_redis()
    raw = r.hgetall(LIVE_RIDES_KEY)
    rides = {}
    for user_id, ride_json in raw.items():
        uid = int(user_id.decode() if isinstance(user_id, bytes) else user_id)
        ride_data = json.loads(ride_json.decode() if isinstance(ride_json, bytes) else ride_json)
        rides[uid] = ride_data
    return rides


def set_live_ride(user_id: int, ride_data: dict):
    """Set a single ride in the Redis hash."""
    r = get_redis()
    r.hset(LIVE_RIDES_KEY, str(user_id), json.dumps(ride_data))


def delete_live_ride(user_id: int):
    """Delete a ride from the Redis hash."""
    r = get_redis()
    r.hdel(LIVE_RIDES_KEY, str(user_id))


def get_live_ride_count() -> int:
    """Get count of active rides."""
    r = get_redis()
    return r.hlen(LIVE_RIDES_KEY)


def get_live_city_counts() -> dict[str, int]:
    """Active riders per simulator city (for live-map overview badges)."""
    from simulate_active_cities import CITIES
    from activities.ride_fsm import telemetry_eligible

    counts = {c['slug']: 0 for c in CITIES}
    for ride in get_live_rides().values():
        if not telemetry_eligible(ride):
            continue
        slug = ride.get('city_slug') or ''
        if slug in counts:
            counts[slug] += 1
    return counts


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

def acquire_live_tick_lock() -> bool:
    """Prevent overlapping ticks when poll endpoints and background loop fire together."""
    r = get_redis()
    return bool(r.set(LIVE_TICK_LOCK_KEY, "1", nx=True, ex=30))


def release_live_tick_lock():
    r = get_redis()
    r.delete(LIVE_TICK_LOCK_KEY)


def maybe_advance_live_simulation() -> bool:
    """Trigger a live sim tick if the interval elapsed. Safe from any poll endpoint."""
    state = get_live_state()
    if not state.get('running'):
        return False

    if live_tick_stale():
        heal_stale_live_simulation(reschedule=True)
        state = get_live_state()

    now = time.time()
    try:
        last_tick = float(state.get('last_tick_at') or 0)
    except (ValueError, TypeError):
        last_tick = 0.0
    try:
        tick_seconds = float(state.get('tick_seconds', 8))
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
            if not get_live_state().get('running'):
                break
            try:
                tick_seconds = max(2, int(get_live_state().get('tick_seconds', 8)))
            except (ValueError, TypeError):
                tick_seconds = 8
            if _tick_loop_stop.wait(tick_seconds):
                break
            if not get_live_state().get('running'):
                break
            from activities.simulator_tasks import live_tick_task
            try:
                live_tick_task()
            except Exception:
                pass

    _tick_loop_thread = threading.Thread(target=_loop, daemon=True, name='live-sim-tick')
    _tick_loop_thread.start()


def stop_live_tick_loop():
    _tick_loop_stop.set()


def validate_athlete_pool(min_users: int = 10) -> dict:
    """Pre-flight check: count available ATHLETE users."""
    from users.models import User
    count = User.objects.filter(role='ATHLETE').count()
    return {
        'has_athletes': count >= min_users,
        'athlete_count': count,
        'min_required': min_users,
        'error': None if count >= min_users else f"Only {count} ATHLETE users found (need {min_users}). Run batch generator first.",
    }
