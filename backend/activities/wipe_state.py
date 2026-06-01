"""Redis-backed progress for chunked async data wipe."""
import json
import time

from core.redis_cluster import get_redis

WIPE_STATE_KEY = '{admin}:wipe:state'
WIPE_LOG_KEY = '{admin}:wipe:log'
WIPE_LOCK_KEY = '{admin}:wipe:lock'
WIPE_LOCK_TTL = 3600


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


def acquire_wipe_lock() -> bool:
    r = get_redis()
    return bool(r.set(WIPE_LOCK_KEY, '1', nx=True, ex=WIPE_LOCK_TTL))


def release_wipe_lock():
    r = get_redis()
    r.delete(WIPE_LOCK_KEY)
