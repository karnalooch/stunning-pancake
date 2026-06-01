"""
Scale limits for large simulations (e.g. 300k athletes).

Override via environment variables. See docs/SCALE_TEST_300K.md.
"""
import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


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
