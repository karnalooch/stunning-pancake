"""
Pre-flight analysis for large-scale (e.g. 300k) load tests.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model

from activities import simulator_state as sim
from activities.scale_config import (
    BATCH_PARALLEL_MIN_USERS,
    FORCE_SKIP_ACTIVITIES_ABOVE,
    MAX_BATCH_USERS,
    MAX_CONCURRENT_RIDERS,
    MAX_LIVE_POOL,
    MAX_LIVE_POOL_REDIS,
    MAX_TELEMETRY_PUBLISH_PER_TICK,
    SKIP_ACTIVITIES_WARN_ABOVE,
    SKIP_GLOBAL_LIVE_POOL_ABOVE,
    TELEMETRY_API_DEFAULT_LIMIT,
    compute_batch_scaling,
    should_skip_global_live_pool,
)
from activities.services import TelemetryService


def analyze_scale(
    target_users: int,
    active_ratio: float = 0.3,
    skip_activities: bool = False,
    generate_activities: bool = True,
) -> dict:
    """Return risks and recommended settings for a planned scale test."""
    User = get_user_model()
    athlete_count = User.objects.filter(role='ATHLETE').count()
    target = min(int(target_users), MAX_BATCH_USERS)

    concurrent = min(MAX_CONCURRENT_RIDERS, max(1, int(target * active_ratio)))

    risks: list[dict] = []
    recommendations: list[str] = []

    # --- Database ---
    if target > 100_000 and generate_activities and not skip_activities:
        risks.append({
            'severity': 'critical',
            'area': 'postgresql',
            'title': 'Miliony aktywności GPS',
            'detail': (
                f'Generowanie aktywności dla {target:,} użytkowników może trwać dni '
                'i zapchać dysk (PostGIS LineString).'
            ),
        })
        recommendations.append('Użyj skip_activities=true przy tworzeniu 300k użytkowników.')

    if target > SKIP_ACTIVITIES_WARN_ABOVE and not skip_activities:
        risks.append({
            'severity': 'high',
            'area': 'batch',
            'title': 'Wolny batch bez skip_activities',
            'detail': 'Zalecane pominięcie aktywności historycznych przy dużej puli.',
        })

    if target > 50_000:
        risks.append({
            'severity': 'info',
            'area': 'postgresql',
            'title': 'Dashboard admin/stats',
            'detail': 'Pierwsze odświeżenie KPI może trwać kilka s; potem cache 120s i tryb stale podczas batch.',
        })

    # --- Redis / live sim ---
    if should_skip_global_live_pool(target):
        pool_detail = (
            f'Przy ≥{SKIP_GLOBAL_LIVE_POOL_ABOVE:,} athlete live sim używa próbkowania DB per miasto '
            f'(bez globalnego Redis SET 300k).'
        )
    else:
        pool_detail = (
            f'Pula Redis capped do {MAX_LIVE_POOL_REDIS:,} ID; jednocześnie jeździ max '
            f'{MAX_CONCURRENT_RIDERS:,} (telemetria: max {MAX_TELEMETRY_PUBLISH_PER_TICK:,}/tick).'
        )
    risks.append({
        'severity': 'info',
        'area': 'redis',
        'title': 'Pula vs aktywni na mapie',
        'detail': pool_detail,
    })

    if target >= 100_000:
        risks.append({
            'severity': 'high',
            'area': 'postgresql',
            'title': 'Dysk Postgres (bulk_create + temp)',
            'detail': (
                'Railway Postgres potrzebuje ≥10 GB wolnego miejsca na 300k insertów '
                '(pgsql_tmp/WAL). Zmniejsz SCALE_USER_BULK_PG_BATCH_SIZE jeśli "No space left on device".'
            ),
        })
        recommendations.append('Nie uruchamiaj live sim podczas batch 300k.')

    if target * active_ratio > MAX_CONCURRENT_RIDERS:
        risks.append({
            'severity': 'medium',
            'area': 'live_sim',
            'title': 'active_ratio obcięty',
            'detail': (
                f'Żądane ~{int(target * active_ratio):,} aktywnych jazd, limit systemu '
                f'{MAX_CONCURRENT_RIDERS:,}.'
            ),
        })

    # --- Frontend ---
    risks.append({
        'severity': 'low',
        'area': 'frontend',
        'title': 'Mapa na żywo',
        'detail': (
            f'API zwraca max {TELEMETRY_API_DEFAULT_LIMIT} punktów w bbox; '
            'reszta puli nie jest rysowana (klastry przy zoom out).'
        ),
    })

    # --- What used to hang ---
    legacy = [
        'HGETALL na 300k pozycji w Redis (naprawione: GEO + HMGET)',
        'SMEMBERS całej puli w każdym ticku Celery (naprawione: SRANDMEMBER)',
        '90k jednoczesnych jazd w HASH rides (naprawione: cap MAX_CONCURRENT_RIDERS)',
        'User.objects.filter().exists() × 300k przy seed (naprawione: bulk bez exists)',
        'Dashboard COUNT w pętli per-tenant (naprawione: annotate + cache 120s, stale podczas batch)',
        'Heatmap cały kraj bez limitu (naprawione: max bbox km, min zoom, cache Redis, iterator)',
        'Wipe jednym DELETE (naprawione: chunked async + polling GET)',
    ]
    for item in legacy:
        risks.append({
            'severity': 'resolved',
            'area': 'code',
            'title': 'Było: zawieszenie',
            'detail': item,
        })

    force_skip = target >= FORCE_SKIP_ACTIVITIES_ABOVE and generate_activities
    effective_skip = skip_activities or force_skip

    batch_plan = compute_batch_scaling(target)
    est_batch_sec = batch_plan['estimated_batch_seconds']
    if effective_skip:
        est_label = (
            f"~{est_batch_sec // 60}–{(est_batch_sec * 2) // 60} min "
            f"({batch_plan['num_cities']} cities × {batch_plan['users_per_city']:,}, "
            f"bulk {batch_plan['user_bulk_batch_size']:,}, "
            f"parallel≤{batch_plan['max_parallel_workers']})"
        )
    else:
        est_label = 'hours–days (activities enabled)'

    if target >= BATCH_PARALLEL_MIN_USERS and effective_skip:
        recommendations.append(
            f"Batch Celery: {est_label}. "
            f"Tune SCALE_BATCH_MAX_PARALLEL_WORKERS on weak Postgres."
        )

    return {
        'target_users': target,
        'athletes_in_db': athlete_count,
        'needs_batch_first': athlete_count < target,
        'effective_skip_activities': effective_skip,
        'force_skip_activities': force_skip,
        'max_live_pool': MAX_LIVE_POOL,
        'max_concurrent_riders': MAX_CONCURRENT_RIDERS,
        'estimated_concurrent_riders': concurrent,
        'batch_plan': batch_plan,
        'estimated_batch_seconds': est_batch_sec,
        'estimated_batch_label': est_label,
        'limits': {
            'MAX_BATCH_USERS': MAX_BATCH_USERS,
            'MAX_LIVE_POOL': MAX_LIVE_POOL,
            'MAX_CONCURRENT_RIDERS': MAX_CONCURRENT_RIDERS,
            'MAX_TELEMETRY_PUBLISH_PER_TICK': MAX_TELEMETRY_PUBLISH_PER_TICK,
        },
        'risks': risks,
        'recommendations': recommendations,
        'live_state': sim.get_live_state(),
        'telemetry_redis_active': _telemetry_active_count(),
    }


def _telemetry_active_count() -> int:
    try:
        from core.redis_cluster import get_redis
        r = get_redis()
        return int(r.hlen(TelemetryService._positions_key()) or 0)
    except Exception:
        return 0
