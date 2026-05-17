"""
Redis-based Simulator State Manager
=====================================
Replaces in-process _simulation_state and _live_state dicts.
All state is stored in Redis so any WSGI worker can read/write it.
"""
import json
import time
from typing import Any

from core.redis_cluster import get_redis

REDIS_PREFIX = "sim:"

# ─── Batch Simulation State ──────────────────────────────────────

BATCH_STATE_KEY = "{sim}:batch:state"
BATCH_LOG_KEY = "{sim}:batch:log"
BATCH_LOCK_KEY = "{sim}:batch:lock"
BATCH_LOCK_TTL = 3600  # 1 hour max


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
    state['running'] = state.get('running', 'false') == 'true'
    state['scale'] = float(state.get('scale', 0))
    state['days'] = int(state.get('days', 0))
    state['total_users'] = int(state.get('total_users', 0))
    state['users_created'] = int(state.get('users_created', 0))
    state['departments_created'] = int(state.get('departments_created', 0))
    state['activities_created'] = int(state.get('activities_created', 0))
    state['progress_pct'] = float(state.get('progress_pct', 0))
    state['started_at'] = float(state['started_at']) if state.get('started_at') else None
    state['completed_at'] = float(state['completed_at']) if state.get('completed_at') else None
    return state


def set_batch_state(**kwargs):
    """Update batch simulation state fields in Redis."""
    r = get_redis()
    r.hset(BATCH_STATE_KEY, mapping={k: str(v) for k, v in kwargs.items()})
    r.expire(BATCH_STATE_KEY, 86400)  # 24h TTL


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
    return [json.loads(line.decode() if isinstance(line, bytes) else line) for line in raw]


def acquire_batch_lock() -> bool:
    """Acquire distributed lock for batch simulation. Returns True if acquired."""
    r = get_redis()
    return bool(r.set(BATCH_LOCK_KEY, "1", nx=True, ex=BATCH_LOCK_TTL))


def release_batch_lock():
    """Release the batch simulation lock."""
    r = get_redis()
    r.delete(BATCH_LOCK_KEY)


# ─── Live Simulation State ──────────────────────────────────────

LIVE_STATE_KEY = "{sim}:live:state"
LIVE_LOG_KEY = "{sim}:live:log"
LIVE_LOCK_KEY = "{sim}:live:lock"
LIVE_POOL_KEY = "{sim}:live:pool"       # Redis set of user IDs
LIVE_RIDES_KEY = "{sim}:live:rides"     # Redis hash of active rides
LIVE_LOCK_TTL = 300  # 5 min (refreshed by runner)


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
    state['running'] = state.get('running', 'false') == 'true'
    state['total_users'] = int(state.get('total_users', 0))
    state['active_ratio'] = float(state.get('active_ratio', 0))
    state['cheat_ratio'] = float(state.get('cheat_ratio', 0))
    state['tick_seconds'] = int(state.get('tick_seconds', 10))
    state['currently_riding'] = int(state.get('currently_riding', 0))
    state['total_completed'] = int(state.get('total_completed', 0))
    state['cheaters_caught'] = int(state.get('cheaters_caught', 0))
    state['started_at'] = float(state['started_at']) if state.get('started_at') else None
    return state


def set_live_state(**kwargs):
    """Update live simulation state fields in Redis."""
    r = get_redis()
    r.hset(LIVE_STATE_KEY, mapping={k: str(v) for k, v in kwargs.items()})
    r.expire(LIVE_STATE_KEY, 86400)


def reset_live_state():
    """Clear all live simulation state."""
    r = get_redis()
    r.delete(LIVE_STATE_KEY, LIVE_LOG_KEY, LIVE_POOL_KEY, LIVE_RIDES_KEY)


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
    return [json.loads(line.decode() if isinstance(line, bytes) else line) for line in raw]


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


def set_live_pool(user_ids: list):
    """Set the user pool for live simulation."""
    r = get_redis()
    r.delete(LIVE_POOL_KEY)
    if user_ids:
        r.sadd(LIVE_POOL_KEY, *[str(uid) for uid in user_ids])


def get_live_pool() -> list:
    """Get all user IDs in the live pool."""
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


# ─── Validation ──────────────────────────────────────────────────

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
