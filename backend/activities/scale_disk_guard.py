"""
Automatic Postgres disk safeguards for batch simulation.

No manual wipe / disk monitoring required when SCALE_AUTO_DISK_GUARD is on (default).
"""
from __future__ import annotations

import time
from typing import Any

from django.contrib.auth import get_user_model
from django.db import connection

from activities.scale_config import (
    AUTO_DISK_GUARD,
    AUTO_WIPE_BEFORE_BATCH,
    BATCH_WARN_WITHOUT_WIPE_ABOVE,
    DISK_HEADROOM_GB,
    POSTGRES_DISK_BUDGET_GB,
    WIPE_WAIT_TIMEOUT_SEC,
    compute_batch_scaling,
    estimate_batch_disk_gb,
)


def is_disk_full_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return 'no space left on device' in msg or 'could not extend file' in msg


def get_database_size_bytes() -> int | None:
    """Current DB size via pg_database_size (None if unavailable, e.g. SQLite)."""
    if connection.vendor != 'postgresql':
        return None
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_database_size(current_database())')
            row = cursor.fetchone()
            return int(row[0]) if row else None
    except Exception:
        return None


def get_database_size_gb() -> float | None:
    nbytes = get_database_size_bytes()
    if nbytes is None:
        return None
    return round(nbytes / (1024 ** 3), 3)


def _usage_ratio(db_gb: float | None, projected_delta_gb: float) -> float | None:
    if db_gb is None:
        return None
    budget = max(0.5, float(POSTGRES_DISK_BUDGET_GB))
    projected = db_gb + projected_delta_gb + float(DISK_HEADROOM_GB)
    return projected / budget


def adjust_batch_plan_for_disk_pressure(
    plan: dict,
    *,
    usage_ratio: float | None,
) -> dict:
    """Reduce PG chunk and parallel workers when projected usage is high."""
    out = dict(plan)
    if usage_ratio is None:
        return out

    pg = int(out.get('user_bulk_pg_batch_size', 500))
    parallel = int(out.get('max_parallel_workers', 4))
    bulk = int(out.get('user_bulk_batch_size', 2500))

    if usage_ratio >= 1.0:
        pg = max(50, pg // 4)
        parallel = max(1, min(parallel, 2))
        bulk = max(1000, bulk // 2)
    elif usage_ratio >= 0.85:
        pg = max(50, pg // 2)
        parallel = max(1, min(parallel, 3))
    elif usage_ratio >= 0.7:
        pg = max(50, int(pg * 0.75))
        parallel = max(1, min(parallel, max(2, parallel - 1)))

    out['user_bulk_pg_batch_size'] = pg
    out['user_bulk_batch_size'] = bulk
    out['max_parallel_workers'] = parallel
    out['max_parallel_cities'] = min(int(out.get('num_cities', 10)), parallel)
    out['disk_usage_ratio'] = round(usage_ratio, 3)
    return out


def wait_for_wipe_completed(timeout_sec: float | None = None, poll_sec: float = 2.0) -> bool:
    from activities import wipe_state as ws

    deadline = time.time() + float(timeout_sec or WIPE_WAIT_TIMEOUT_SEC)
    while time.time() < deadline:
        state = ws.get_wipe_state()
        if not state.get('running'):
            return state.get('phase') == 'complete' and not state.get('error')
        time.sleep(poll_sec)
    return False


def _should_auto_wipe(
    target_users: int,
    athlete_count: int,
    *,
    skip_activities: bool,
    db_gb: float | None,
    clear: bool,
) -> tuple[bool, str]:
    if not AUTO_WIPE_BEFORE_BATCH:
        return False, ''

    estimated = estimate_batch_disk_gb(target_users, skip_activities=skip_activities)
    ratio = _usage_ratio(db_gb, estimated)

    if clear and athlete_count > 0:
        return True, 'clear=true — automatyczny wipe przed batch'

    if target_users >= BATCH_WARN_WITHOUT_WIPE_ABOVE and athlete_count > 0:
        if athlete_count >= target_users * 0.25:
            return True, (
                f're-seed: {athlete_count:,} athlete w bazie, cel {target_users:,}'
            )
        if ratio is not None and ratio >= 0.75:
            return True, (
                f'dysk: szac. {ratio * 100:.0f}% budżetu po batchu '
                f'({db_gb:.1f} + ~{estimated:.1f} GB)'
            )

    if ratio is not None and ratio >= 0.9:
        return True, f'dysk krytyczny ({ratio * 100:.0f}% budżetu)'

    return False, ''


def prepare_batch_disk_guard(
    target_users: int,
    *,
    skip_activities: bool = True,
    clear: bool = False,
) -> dict[str, Any]:
    """
    Run before batch insert: optional auto-wipe, tune chunk sizes, or abort if impossible.

    Returns { ok, batch_plan, actions[], error?, db_size_gb, disk_usage_ratio? }.
    """
    target = max(0, int(target_users))
    actions: list[str] = []

    if not AUTO_DISK_GUARD or target < 1_000:
        plan = compute_batch_scaling(max(1, target)) if target else {}
        return {'ok': True, 'batch_plan': plan, 'actions': actions, 'db_size_gb': get_database_size_gb()}

    User = get_user_model()
    athlete_count = User.objects.filter(role='ATHLETE').count()
    db_gb = get_database_size_gb()
    estimated = estimate_batch_disk_gb(target, skip_activities=skip_activities)
    plan = compute_batch_scaling(target)

    do_wipe, wipe_reason = _should_auto_wipe(
        target, athlete_count, skip_activities=skip_activities, db_gb=db_gb, clear=clear,
    )

    if do_wipe:
        from activities import wipe_state as ws
        from activities.wipe_tasks import run_wipe_sync

        if ws.get_wipe_state().get('running'):
            actions.append('Oczekiwanie na trwający wipe…')
            if not wait_for_wipe_completed():
                return {
                    'ok': False,
                    'error': 'Automatyczny wipe: timeout — spróbuj ponownie później.',
                    'batch_plan': plan,
                    'actions': actions,
                    'db_size_gb': db_gb,
                }
        else:
            actions.append(f'Automatyczny wipe: {wipe_reason}')
            result = run_wipe_sync()
            if result.get('status') == 'locked':
                if not wait_for_wipe_completed():
                    return {
                        'ok': False,
                        'error': 'Automatyczny wipe: nie udało się uzyskać blokady.',
                        'batch_plan': plan,
                        'actions': actions,
                        'db_size_gb': db_gb,
                    }
            elif result.get('status') != 'complete':
                return {
                    'ok': False,
                    'error': f"Automatyczny wipe nie powiódł się: {result.get('error', result)}",
                    'batch_plan': plan,
                    'actions': actions,
                    'db_size_gb': db_gb,
                }
            actions.append('Wipe zakończony.')
            db_gb = get_database_size_gb()
            athlete_count = 0

    ratio = _usage_ratio(db_gb, estimated)
    plan = adjust_batch_plan_for_disk_pressure(plan, usage_ratio=ratio)

    if ratio is not None and ratio > 1.15:
        budget = POSTGRES_DISK_BUDGET_GB
        return {
            'ok': False,
            'error': (
                f'Za mało miejsca na Postgres (budżet {budget} GB, baza ~{db_gb or 0:.1f} GB, '
                f'batch ~{estimated:.1f} GB). Zwiększ wolumen lub ustaw '
                f'SCALE_POSTGRES_DISK_BUDGET_GB na rozmiar wolumenu Railway.'
            ),
            'batch_plan': plan,
            'actions': actions,
            'db_size_gb': db_gb,
            'disk_usage_ratio': ratio,
        }

    if ratio is not None and ratio >= 0.7:
        actions.append(
            f'Dopasowano inserty: pg_chunk={plan["user_bulk_pg_batch_size"]}, '
            f'parallel≤{plan["max_parallel_workers"]} '
            f'(dysk ~{ratio * 100:.0f}% budżetu).'
        )

    return {
        'ok': True,
        'batch_plan': plan,
        'actions': actions,
        'db_size_gb': db_gb,
        'disk_usage_ratio': ratio,
        'athletes_in_db': athlete_count,
    }
