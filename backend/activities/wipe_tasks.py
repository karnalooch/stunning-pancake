"""
Chunked background wipe — avoids long DELETE locks on 300k+ rows.
"""
import os
import threading

from celery import shared_task

from activities import wipe_state as ws
from activities.admin_stats import invalidate_dashboard_stats_cache
from activities.services import TelemetryService


from activities.scale_config import WIPE_CHUNK_SIZE as CHUNK


def _chunk_delete(qs, label: str, deleted: dict, progress_base: float, progress_span: float):
    total_removed = 0
    model = qs.model
    while True:
        ids = list(qs.values_list('pk', flat=True)[:CHUNK])
        if not ids:
            break
        n, _ = model.objects.filter(pk__in=ids).delete()
        total_removed += n
        deleted[label] = total_removed
        ws.set_wipe_state(deleted=deleted, progress_pct=round(progress_base + progress_span * 0.5, 1))
        ws.wipe_log(f'{label}: {total_removed:,} deleted…')
    return total_removed


@shared_task(bind=True, queue='simulation', max_retries=0)
def wipe_data_task(self):
    return run_wipe_sync()


def run_wipe_sync():
    if not ws.acquire_wipe_lock():
        return {'status': 'locked'}

    from django.contrib.auth import get_user_model
    from users.models import User, Tenant
    from users.departments import Department, UserDepartment
    from activities.models import Activity
    from activities import simulator_state as sim

    ws.reset_wipe_state()
    ws.set_wipe_state(
        running=True, phase='starting', progress_pct=0,
        started_at=__import__('time').time(), error=None, deleted={},
    )
    deleted = {}

    try:
        ws.set_wipe_state(phase='activities', progress_pct=5)
        deleted['activities'] = _chunk_delete(Activity.objects.all(), 'activities', deleted, 5, 35)

        ws.set_wipe_state(phase='departments', progress_pct=40)
        deleted['user_departments'] = _chunk_delete(UserDepartment.objects.all(), 'user_departments', deleted, 40, 10)
        deleted['departments'] = _chunk_delete(Department.objects.all(), 'departments', deleted, 50, 10)

        ws.set_wipe_state(phase='users', progress_pct=60)
        User = get_user_model()
        deleted['users'] = _chunk_delete(
            User.objects.exclude(role='GLOBAL_OWNER'),
            'users', deleted, 60, 30,
        )

        ws.set_wipe_state(phase='tenants', progress_pct=92)
        deleted['tenants'] = _chunk_delete(Tenant.objects.all(), 'tenants', deleted, 92, 5)

        owner, _ = User.objects.get_or_create(
            username='global_owner',
            defaults={
                'email': 'owner@4velo.app', 'role': 'GLOBAL_OWNER',
                'is_superuser': True, 'is_staff': True,
            },
        )
        owner.set_password(os.getenv('GLOBAL_OWNER_PASSWORD', 'admin123'))
        owner.is_superuser = True
        owner.is_staff = True
        owner.role = 'GLOBAL_OWNER'
        owner.save()

        sim.reset_batch_state()
        sim.reset_live_state()
        TelemetryService.clear_simulator_positions()
        invalidate_dashboard_stats_cache()

        ws.wipe_log('Postgres VACUUM (reclaim space)…')
        _vacuum_postgres_if_needed()

        ws.set_wipe_state(
            running=False, phase='complete', progress_pct=100,
            completed_at=__import__('time').time(), deleted=deleted,
        )
        ws.wipe_log('✅ Wipe complete.')
        return {'status': 'complete', 'deleted': deleted}
    except Exception as e:
        ws.set_wipe_state(running=False, phase='error', error=str(e))
        ws.wipe_log(f'ERROR: {e}')
        return {'status': 'error', 'error': str(e)}
    finally:
        ws.release_wipe_lock()


def _vacuum_postgres_if_needed() -> None:
    """Reclaim disk after large deletes (must run outside a transaction)."""
    from django.db import connection
    if connection.vendor != 'postgresql':
        return
    try:
        old_autocommit = connection.get_autocommit()
        connection.set_autocommit(True)
        try:
            with connection.cursor() as cursor:
                cursor.execute('VACUUM (ANALYZE)')
        finally:
            connection.set_autocommit(old_autocommit)
    except Exception:
        pass


def start_wipe_async() -> bool:
    """Dispatch wipe via Celery or daemon thread (SQLite dev)."""
    import os
    if 'sqlite' in os.getenv('DATABASE_URL', ''):
        threading.Thread(target=run_wipe_sync, daemon=True, name='wipe-data').start()
        return True
    try:
        wipe_data_task.delay()
        return True
    except Exception:
        threading.Thread(target=run_wipe_sync, daemon=True, name='wipe-data').start()
        return True
