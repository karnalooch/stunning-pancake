"""
Pre-flight analysis for large-scale (e.g. 300k) load tests.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model

from activities import simulator_state as sim
from activities.scale_config import (
    AUTO_DISK_GUARD,
    BATCH_PARALLEL_MIN_USERS,
    BATCH_WARN_WITHOUT_WIPE_ABOVE,
    FORCE_SKIP_ACTIVITIES_ABOVE,
    LIVE_POOL_REDIS_FULL_ABOVE,
    MAX_BATCH_USERS,
    MAX_CONCURRENT_RIDERS,
    MAX_LIVE_POOL,
    MAX_LIVE_POOL_REDIS,
    MAX_TELEMETRY_PUBLISH_PER_TICK,
    SKIP_ACTIVITIES_WARN_ABOVE,
    SKIP_GLOBAL_LIVE_POOL_ABOVE,
    TELEMETRY_API_DEFAULT_LIMIT,
    compute_batch_scaling,
    estimate_batch_disk_gb,
    live_pool_mode_for_target,
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

    force_skip = target >= FORCE_SKIP_ACTIVITIES_ABOVE and generate_activities
    effective_skip = skip_activities or force_skip

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

    if target > 5_000:
        risks.append({
            'severity': 'info',
            'area': 'postgresql',
            'title': 'Dashboard admin/stats',
            'detail': 'Pierwsze odświeżenie KPI może trwać kilka s; potem cache 120s i tryb stale podczas batch.',
        })

    disk_gb = estimate_batch_disk_gb(target, skip_activities=effective_skip)
    if target >= 1_000:
        disk_sev = 'high' if disk_gb >= 5 else 'medium' if disk_gb >= 1 else 'info'
        risks.append({
            'severity': disk_sev,
            'area': 'postgresql',
            'title': 'Szacunek dysku Postgres (batch)',
            'detail': (
                f'~{disk_gb:.1f} GB przy {target:,} użytkownikach (skip_activities). '
                f'Przy pełnym dysku zmniejsz SCALE_USER_BULK_PG_BATCH_SIZE lub wykonaj wipe przed dużym runem.'
            ),
        })
        if disk_gb >= 3:
            recommendations.append(
                f'Zapewnij ≥{max(2, int(disk_gb) + 2)} GB wolnego miejsca na wolumenie Postgres.'
            )

    if AUTO_DISK_GUARD and target >= 1_000:
        from activities.scale_disk_guard import get_database_size_gb, resolve_disk_budget_gb
        db_gb = get_database_size_gb()
        budget, src = resolve_disk_budget_gb(db_gb)
        recommendations.append(
            f'Automatyczny disk guard: budżet dysku ~{budget:g} GB ({src}), wipe + chunki bez ręcznej konfiguracji.'
        )
    elif target >= BATCH_WARN_WITHOUT_WIPE_ABOVE and athlete_count > 0:
        risks.append({
            'severity': 'medium' if athlete_count < target else 'high',
            'area': 'batch',
            'title': 'Batch bez wipe',
            'detail': (
                f'W bazie jest już {athlete_count:,} athlete; dodajesz ~{target:,}. '
                'Zalecany chunked wipe (`/admin/wipe-data/`) przed pełnym re-seedem.'
            ),
        })
        recommendations.append('Uruchom wipe przed batch >10k jeśli to pełny re-test skali.')

    # --- Redis / live sim ---
    live_mode = live_pool_mode_for_target(target)
    if live_mode == 'db':
        pool_detail = (
            f'Przy ≥{SKIP_GLOBAL_LIVE_POOL_ABOVE:,} live sim: próbkowanie DB per miasto '
            f'(bez globalnego Redis SET).'
        )
    elif target < LIVE_POOL_REDIS_FULL_ABOVE:
        pool_detail = (
            f'Pula Redis do {target:,} ID (mała skala). Max jednocześnie na mapie: '
            f'{MAX_CONCURRENT_RIDERS:,}.'
        )
    else:
        pool_detail = (
            f'Pula Redis capped do {MAX_LIVE_POOL_REDIS:,} ID (cel {target:,}); telemetria max '
            f'{MAX_TELEMETRY_PUBLISH_PER_TICK:,}/tick.'
        )
    risks.append({
        'severity': 'info',
        'area': 'redis',
        'title': 'Pula vs aktywni na mapie',
        'detail': pool_detail,
    })

    if target >= SKIP_GLOBAL_LIVE_POOL_ABOVE:
        recommendations.append('Nie uruchamiaj live sim podczas równoległego batch 50k+.')

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
        'estimated_disk_gb': disk_gb,
        'live_pool_mode': batch_plan.get('live_pool_mode', live_pool_mode_for_target(target)),
        'warn_without_wipe': batch_plan.get('warn_without_wipe', False) and athlete_count > 0,
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
