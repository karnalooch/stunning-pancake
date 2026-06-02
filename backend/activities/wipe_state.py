"""Redis-backed progress for chunked async data wipe."""
import json
import time

from core.redis_cluster import get_redis

WIPE_STATE_KEY = '{admin}:wipe:state'
WIPE_LOG_KEY = '{admin}:wipe:log'
WIPE_LOCK_KEY = '{admin}:wipe:lock'
WIPE_IN_PROGRESS_KEY = '{admin}:wipe:in_progress'
WIPE_LOCK_TTL = 3600
# Queued but Celery never picked up the task (common after worker restart).
WIPE_STALE_QUEUED_SEC = int(__import__('os').getenv('WIPE_STALE_QUEUED_SEC', '120'))
# Running wipe with no progress for too long (crashed worker mid-delete).
WIPE_STALE_RUNNING_SEC = int(__import__('os').getenv('WIPE_STALE_RUNNING_SEC', '3600'))


def get_wipe_state() -> dict:
    r = get_redis()
    raw = r.hgetall(WIPE_STATE_KEY)
    if not raw:
        return {
            'running': False, 'phase': 'idle', 'progress_pct': 0,
            'error': None, 'deleted': {}, 'started_at': None, 'completed_at': None,
        }
    state = {
        k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v
        for k, v in raw.items()
    }
    state['running'] = state.get('running', 'false').lower() == 'true'
    state['progress_pct'] = float(state.get('progress_pct', 0))
    if state.get('deleted'):
        try:
            state['deleted'] = json.loads(state['deleted'])
        except json.JSONDecodeError:
            state['deleted'] = {}
    else:
        state['deleted'] = {}
    return state


def set_wipe_state(**kwargs):
    r = get_redis()
    mapping = {k: str(v) if k != 'deleted' else json.dumps(v) for k, v in kwargs.items()}
    r.hset(WIPE_STATE_KEY, mapping=mapping)
    r.expire(WIPE_STATE_KEY, 86400)


def wipe_log(msg: str):
    r = get_redis()
    ts = time.strftime('%H:%M:%S')
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
    set_wipe_state(
        running=True,
        phase='queued',
        progress_pct=0,
        error=None,
        deleted={},
        started_at=time.time(),
        completed_at=None,
    )


def wipe_status_label(state: dict) -> str:
    """idle | queued | running | complete | error — used by API and clients."""
    phase = state.get('phase') or 'idle'
    if phase == 'complete':
        return 'complete'
    if phase == 'error' or (state.get('error') and phase != 'complete'):
        return 'error'
    if state.get('running'):
        return 'queued' if phase == 'queued' else 'running'
    return 'idle'


def acquire_wipe_lock() -> bool:
    r = get_redis()
    return bool(r.set(WIPE_LOCK_KEY, '1', nx=True, ex=WIPE_LOCK_TTL))


def release_wipe_lock():
    r = get_redis()
    r.delete(WIPE_LOCK_KEY)


def set_wipe_in_progress(enabled: bool, ttl_seconds: int = 3600) -> None:
    """Global barrier checked by simulator start endpoints."""
    r = get_redis()
    if enabled:
        r.set(WIPE_IN_PROGRESS_KEY, '1', ex=max(60, int(ttl_seconds)))
        return
    r.delete(WIPE_IN_PROGRESS_KEY)


def is_wipe_in_progress() -> bool:
    r = get_redis()
    return bool(r.exists(WIPE_IN_PROGRESS_KEY))


def _parse_started_at(state: dict) -> float | None:
    raw = state.get('started_at')
    if raw is None or raw == '':
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def is_wipe_stuck(state: dict) -> bool:
    """True when Redis says running but no worker is making progress."""
    if not state.get('running'):
        return False
    started = _parse_started_at(state)
    if started is None:
        return True
    age = time.time() - started
    phase = (state.get('phase') or '').lower()
    if phase in ('queued', 'starting'):
        return age >= WIPE_STALE_QUEUED_SEC
    return age >= WIPE_STALE_RUNNING_SEC


def force_reset_wipe() -> None:
    """Clear stuck wipe flags so a new DELETE can start."""
    release_wipe_lock()
    reset_wipe_state()
