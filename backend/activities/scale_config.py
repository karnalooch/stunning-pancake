"""
Scale limits for large simulations (e.g. 300k athletes).

Override via environment variables. See docs/SCALE_TEST_300K.md.
"""
from __future__ import annotations

import math
import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _int_env_or(name: str, computed: int) -> int:
    """Use env var when set; otherwise adaptive `computed` default."""
    val = os.getenv(name)
    if val is None or str(val).strip() == '':
        return int(computed)
    try:
        return int(val)
    except (TypeError, ValueError):
        return int(computed)


def _bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.lower() in ('1', 'true', 'yes', 'on')


def _celery_worker_concurrency() -> int:
    try:
        return max(1, int(os.getenv('CELERY_WORKER_CONCURRENCY', '4')))
    except (TypeError, ValueError):
        return 4


# Batch generator (Postgres users)
MAX_BATCH_USERS = _int('SCALE_MAX_BATCH_USERS', 350_000)

# Live sim pool size (Redis SET — not loaded into Python at once)
MAX_LIVE_POOL = _int('SCALE_MAX_LIVE_POOL', 350_000)

# Concurrent riders + telemetry published per tick (memory / Redis hash size)
MAX_CONCURRENT_RIDERS = _int('SCALE_MAX_CONCURRENT_RIDERS', 5_000)
MAX_TELEMETRY_PUBLISH_PER_TICK = _int('SCALE_MAX_TELEMETRY_PUBLISH', 5_000)

# Live map API
TELEMETRY_API_DEFAULT_LIMIT = _int('SCALE_TELEMETRY_API_LIMIT', 500)
TELEMETRY_API_MAX_LIMIT = _int('SCALE_TELEMETRY_API_MAX_LIMIT', 2_000)
TELEMETRY_GEO_RADIUS_KM = _int('SCALE_TELEMETRY_GEO_RADIUS_KM', 80)
# Short TTL for identical bbox+limit live-map polls (seconds)
TELEMETRY_LIVE_CACHE_TTL = _int('SCALE_TELEMETRY_LIVE_CACHE_TTL', 2)

# Redis SADD chunk size when building live pool
POOL_SADD_BATCH = _int('SCALE_POOL_SADD_BATCH', 5_000)

# Above this, batch sim should use skip_activities unless explicitly allowed
SKIP_ACTIVITIES_WARN_ABOVE = _int('SCALE_SKIP_ACTIVITIES_WARN_ABOVE', 50_000)
FORCE_SKIP_ACTIVITIES_ABOVE = _int('SCALE_FORCE_SKIP_ACTIVITIES_ABOVE', 150_000)

# Admin dashboard stats cache TTL (seconds)
STATS_CACHE_TTL = _int('SCALE_STATS_CACHE_TTL', 120)

# Heatmap: max bbox diagonal (km), activities sampled per request, min zoom
HEATMAP_MAX_BBOX_KM = _int('SCALE_HEATMAP_MAX_BBOX_KM', 120)
HEATMAP_MAX_ACTIVITIES_SAMPLE = _int('SCALE_HEATMAP_MAX_ACTIVITIES', 1500)
HEATMAP_MIN_ZOOM = _int('SCALE_HEATMAP_MIN_ZOOM', 7)
HEATMAP_CACHE_TTL = _int('SCALE_HEATMAP_CACHE_TTL', 300)

# Wipe chunks (rows per DELETE batch)
WIPE_CHUNK_SIZE = _int('SCALE_WIPE_CHUNK_SIZE', 5000)

# Celery batch: parallel user creation per city (requires skip_activities)
BATCH_PARALLEL_CITIES = os.getenv('SCALE_BATCH_PARALLEL_CITIES', 'true').lower() in (
    '1', 'true', 'yes', 'on',
)
BATCH_PARALLEL_MIN_USERS = _int('SCALE_BATCH_PARALLEL_MIN_USERS', 5_000)

# Static fallbacks when total_users is unknown (overridden by compute_batch_scaling)
USER_BULK_BATCH_SIZE = _int('SCALE_USER_BULK_BATCH_SIZE', 2500)
USER_BULK_PG_BATCH_SIZE = _int('SCALE_USER_BULK_PG_BATCH_SIZE', 500)

# Batch user insert fast path (skip_activities flows): skip UserDepartment + SELECT refetch
SKIP_DEPT_ON_BATCH = _bool('SCALE_SKIP_DEPT_ON_BATCH', True)
BATCH_FAST_INSERT = _bool('SCALE_BATCH_FAST_INSERT', True)

# Chord city cap (we have 10 CITIES in simulate_active_cities — keep headroom for future)
BATCH_MAX_CITY_TASKS = _int('SCALE_BATCH_MAX_CITY_TASKS', 20)
BATCH_MIN_CITY_TASKS = _int('SCALE_BATCH_MIN_CITY_TASKS', 5)

# Redis progress: flush users_created counter at most every N inserted users (per worker)
BATCH_PROGRESS_REDIS_EVERY = _int('SCALE_BATCH_PROGRESS_REDIS_EVERY', 5000)

# PostgreSQL persistent connections — applied in core.settings (DATABASE_CONN_MAX_AGE, default 60)


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


BATCH_PROGRESS_UI_MIN_SECONDS = _float('SCALE_BATCH_PROGRESS_UI_MIN_SECONDS', 2.0)


def adaptive_user_bulk_batch_size(total_users: int) -> int:
    """Django bulk_create chunk per Redis progress tick — scales with target."""
    total = max(1, int(total_users))
    if os.getenv('SCALE_USER_BULK_BATCH_SIZE'):
        return _int('SCALE_USER_BULK_BATCH_SIZE', 2500)
    if total <= 10_000:
        return 2500
    if total <= 50_000:
        return 3500
    if total <= 150_000:
        return 5000
    # 300k: fewer round-trips, still bounded for worker RAM
    return min(10_000, max(5000, total // 40))


def adaptive_pg_bulk_batch_size(bulk_batch: int) -> int:
    """Inner PG batch_size for bulk_create."""
    if os.getenv('SCALE_USER_BULK_PG_BATCH_SIZE'):
        return _int('SCALE_USER_BULK_PG_BATCH_SIZE', 500)
    return min(1000, max(500, bulk_batch // 5))


def adaptive_parallel_db_workers(total_users: int) -> int:
    """
    Effective parallel city workers hitting Postgres.
    Weak Postgres: set SCALE_BATCH_MAX_PARALLEL_WORKERS=2–3.
    Strong / dedicated simulation worker: 6–7 at 300k.
    """
    concurrency = _celery_worker_concurrency()
    if total_users >= 200_000:
        computed = min(concurrency, 7)
    elif total_users >= 50_000:
        computed = min(concurrency, 5)
    elif total_users >= 10_000:
        computed = min(concurrency, 6)
    else:
        computed = min(concurrency, 4)
    return max(1, _int_env_or('SCALE_BATCH_MAX_PARALLEL_WORKERS', computed))


def plan_batch_cities(total_users: int, max_cities_available: int = 10) -> tuple[int, int]:
    """
    Return (num_cities, users_per_city) for chord parallelism.
    More users → fewer, heavier city tasks (still capped at BATCH_MAX_CITY_TASKS).
    """
    total = max(1, int(total_users))
    cap = min(max_cities_available, BATCH_MAX_CITY_TASKS)
    floor_n = min(BATCH_MIN_CITY_TASKS, cap)

    if total < BATCH_PARALLEL_MIN_USERS:
        n = min(cap, max(3, min(3, floor_n)))
    elif total <= 15_000:
        # ~10k: maximize parallelism (~10 cities × ~1k)
        n = min(cap, max(floor_n, min(10, (total + 999) // 1000)))
    elif total <= 80_000:
        n = min(cap, max(floor_n, min(10, (total + 4999) // 5000)))
    elif total <= 200_000:
        n = min(cap, max(8, min(10, (total + 9999) // 10_000)))
    else:
        # 300k: ~10 cities × ~30k (parallel capped by worker concurrency / DB)
        n = min(cap, max(8, min(10, (total + 14_999) // 15_000)))

    users_per_city = max(50, math.ceil(total / n))
    return n, users_per_city


def estimate_batch_duration_seconds(
    total_users: int,
    *,
    skip_activities: bool = True,
    num_cities: int | None = None,
    bulk_batch_size: int | None = None,
) -> int:
    """Rough ETA for admin preflight (skip_activities fast path)."""
    total = max(1, int(total_users))
    n_cities, upc = plan_batch_cities(total) if num_cities is None else (num_cities, math.ceil(total / max(1, num_cities)))
    bulk = bulk_batch_size or adaptive_user_bulk_batch_size(total)
    parallel = adaptive_parallel_db_workers(total)

    if not skip_activities:
        # activities dominate — very rough
        return max(600, int(total * 0.05))

    # ~400–800 users/s per worker fast insert (varies by disk); conservative
    users_per_sec = 350.0 * min(parallel, n_cities)
    base = total / max(users_per_sec, 50.0)
    setup = 30 + n_cities * 2  # tenants/depts phases
    bulk_rounds = (upc / max(bulk, 1)) * n_cities
    redis_overhead = bulk_rounds * 0.05
    return max(60, int(base + setup + redis_overhead))


def compute_batch_scaling(total_users: int, max_cities_available: int = 10) -> dict:
    """Single entry point for adaptive batch parameters."""
    total = min(max(1, int(total_users)), MAX_BATCH_USERS)
    num_cities, users_per_city = plan_batch_cities(total, max_cities_available)
    bulk_batch = adaptive_user_bulk_batch_size(total)
    pg_batch = adaptive_pg_bulk_batch_size(bulk_batch)
    parallel_workers = adaptive_parallel_db_workers(total)
    progress_every = _int_env_or(
        'SCALE_BATCH_PROGRESS_REDIS_EVERY',
        max(2500, min(10_000, bulk_batch * 2)),
    )

    return {
        'total_users': total,
        'num_cities': num_cities,
        'users_per_city': users_per_city,
        'user_bulk_batch_size': bulk_batch,
        'user_bulk_pg_batch_size': pg_batch,
        'max_parallel_workers': parallel_workers,
        'max_parallel_cities': min(num_cities, parallel_workers),
        'batch_progress_redis_every': progress_every,
        'batch_progress_ui_min_seconds': BATCH_PROGRESS_UI_MIN_SECONDS,
        'use_parallel_cities': (
            BATCH_PARALLEL_CITIES
            and total >= BATCH_PARALLEL_MIN_USERS
        ),
        'estimated_batch_seconds': estimate_batch_duration_seconds(
            total, skip_activities=True, num_cities=num_cities, bulk_batch_size=bulk_batch,
        ),
        'force_skip_activities': total >= FORCE_SKIP_ACTIVITIES_ABOVE,
    }
