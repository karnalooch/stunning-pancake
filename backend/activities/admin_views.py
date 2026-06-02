import csv
import io
import math
import os
import random
import time
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Sum, Count, Q
from django.http import HttpResponse
from django.utils import timezone
from django.conf import settings as django_settings
from datetime import timedelta
from rest_framework.pagination import PageNumberPagination
from .models import Activity
from .serializers import ActivitySerializer
from users.models import Tenant
from users.permissions import IsAdminOrModerator, IsGlobalOwner
from . import simulator_state as sim
from .simulator_tasks import run_batch_simulation, run_live_simulation

# Keep IsAdminRole as an alias for backward compatibility
IsAdminRole = IsAdminOrModerator


def _bootstrap_live_athletes(min_users: int = 500) -> dict:
    """
    Ensure a minimal ATHLETE pool exists so quick live-sim can start after wipe.
    Creates city tenants on demand and lightweight athlete users (no activities/departments).
    """
    from django.contrib.auth.hashers import make_password
    from users.models import User, Tenant
    from simulate_active_cities import CITIES

    current = User.objects.filter(role='ATHLETE').count()
    if current >= min_users:
        return {'created': 0, 'total': current}

    to_create = max(0, int(min_users) - current)
    if to_create == 0:
        return {'created': 0, 'total': current}

    per_city = max(1, math.ceil(to_create / max(1, len(CITIES))))
    pwd = make_password('Athlete2026!')
    created_total = 0

    for city in CITIES:
        if created_total >= to_create:
            break
        slug = city['slug']
        tenant, _ = Tenant.objects.get_or_create(name=city['name'])
        already = User.objects.filter(username__startswith=f'{slug}_athlete_').count()

        batch = []
        for i in range(per_city):
            if created_total >= to_create:
                break
            idx = already + i + 1
            username = f"{slug}_athlete_{idx:06d}"
            batch.append(User(
                username=username,
                email=f'{username}@aktywnemiasta.pl',
                role='ATHLETE',
                tenant=tenant,
                password=pwd,
            ))
            created_total += 1

        if batch:
            User.objects.bulk_create(batch, batch_size=1000, ignore_conflicts=True)

    total = User.objects.filter(role='ATHLETE').count()
    return {'created': max(0, total - current), 'total': total}


class ActivityPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 500


class GlobalActivityListView(generics.ListAPIView):
    """
    List all activities for Global Owners.
    """
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    pagination_class = ActivityPagination

    def get_queryset(self):
        if self.request.user.role == 'GLOBAL_OWNER':
            return Activity.objects.select_related('user', 'tenant').all()
        return Activity.objects.none()

class TenantActivityListView(generics.ListAPIView):
    """
    List activities for Tenant Admins and Moderators (limited to their tenant).
    """
    serializer_class = ActivitySerializer
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    pagination_class = ActivityPagination

    def get_queryset(self):
        if self.request.user.role in ('TENANT_ADMIN', 'TENANT_MODERATOR') and self.request.user.tenant_id:
            return Activity.objects.filter(
                tenant_id=self.request.user.tenant_id
            ).select_related('user')
        return Activity.objects.none()


class AdminDashboardStatsView(APIView):
    """
    Returns high-level platform KPIs for the admin dashboard with per-tenant breakdown.
    Uses aggregate queries + Redis cache; serves stale cache while batch/live sim runs.
    """
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def get(self, request):
        from activities.admin_stats import (
            build_dashboard_stats,
            get_cached_dashboard_stats,
            _empty_stats,
        )
        import logging

        refresh = request.query_params.get('refresh') == '1'
        try:
            return Response(build_dashboard_stats(request.user, refresh=refresh))
        except Exception as exc:
            logging.getLogger(__name__).exception('admin/stats failed')
            cached = get_cached_dashboard_stats()
            if cached:
                out = dict(cached)
                out['stale'] = True
                out['stats_note'] = 'served_from_cache_after_error'
                return Response(out)
            return Response(
                _empty_stats(stale=True, note=str(exc)[:120]),
                status=status.HTTP_200_OK,
            )


class DepartmentAnalyticsView(APIView):
    """
    Returns per-department statistics for the Department Analytics page.
    GET /api/activities/analytics/department/
    """
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def get(self, request):
        from users.departments import Department

        # GLOBAL_OWNER sees all active departments; tenant-scoped roles see only their own
        if request.user.role == 'GLOBAL_OWNER':
            departments = Department.objects.filter(is_active=True)
        elif request.user.role in ('TENANT_ADMIN', 'TENANT_MODERATOR') and request.user.tenant_id:
            departments = Department.objects.filter(tenant_id=request.user.tenant_id, is_active=True)
        else:
            departments = Department.objects.none()

        result = []
        for dept in departments:
            dept_user_ids = dept.members.values_list('id', flat=True)
            dept_activities = Activity.objects.filter(user_id__in=dept_user_ids)
            dept_act_count = dept_activities.count()
            dept_distance = dept_activities.aggregate(Sum('distance'))['distance__sum'] or 0
            dept_verified = dept_activities.filter(is_verified=True).count()
            result.append({
                "department_id": dept.id,
                "department_name": dept.name,
                "users": dept.members.count(),
                "activities": dept_act_count,
                "distance_km": round(float(dept_distance / 1000.0), 1),
                "verified_pct": round((dept_verified / dept_act_count * 100), 1) if dept_act_count > 0 else 0.0,
            })

        return Response(result)


class ActivityApproveView(APIView):
    """
    Approve an activity (marks it as verified, score 1.0).
    """
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def post(self, request, activity_id):
        try:
            activity = Activity.objects.select_related("user").get(pk=activity_id)
            activity.is_verified = True
            activity.verification_score = 1.0
            activity.save(update_fields=["is_verified", "verification_score"])

            from activities.leaderboard_credit import credit_verified_activity
            credited = credit_verified_activity(activity)

            return Response({
                "status": "approved",
                "activity_id": activity.id,
                "user": activity.user.username,
                "verification_score": activity.verification_score,
                "leaderboard_credited": credited,
            })
        except Activity.DoesNotExist:
            return Response({"error": "activity not found"}, status=status.HTTP_404_NOT_FOUND)


class ActivityRejectView(APIView):
    """
    Reject an activity (marks it as unverified, score 0.0).
    """
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def post(self, request, activity_id):
        try:
            activity = Activity.objects.get(pk=activity_id)
            activity.is_verified = False
            activity.verification_score = 0.0
            activity.save()
            return Response({
                "status": "rejected",
                "activity_id": activity.id,
                "user": activity.user.username,
                "verification_score": activity.verification_score,
            })
        except Activity.DoesNotExist:
            return Response({"error": "activity not found"}, status=status.HTTP_404_NOT_FOUND)


class ExportDataView(APIView):
    """
    Export data in multiple formats: csv, json, pdf.
    GET /api/activities/export/<resource>/?format=csv
    Resources: activities, users, statistics
    """
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def get(self, request, resource):
        export_format = request.query_params.get('format', 'json')

        if resource == 'activities':
            data = self._export_activities(export_format)
        elif resource == 'users':
            data = self._export_users(export_format)
        elif resource == 'statistics':
            data = self._export_statistics(export_format)
        else:
            return Response({'error': f'Unknown resource: {resource}'}, status=status.HTTP_400_BAD_REQUEST)

        if export_format == 'json':
            return Response(data)
        elif export_format == 'csv':
            return self._build_csv_response(data, resource)
        elif export_format == 'pdf':
            return self._build_text_report_response(data, resource)
        else:
            return Response(data)

    def _build_csv_response(self, data, resource):
        """Build a CSV HTTP response from export data."""
        output = io.StringIO()
        records = data.get('data', [])
        if records:
            writer = csv.DictWriter(output, fieldnames=records[0].keys())
            writer.writeheader()
            writer.writerows(records)
        else:
            output.write('No data available.\r\n')
        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{resource}.csv"'
        return response

    def _build_text_report_response(self, data, resource):
        """Build a plain-text report HTTP response for PDF-requested exports.
        Uses text/plain since PDF-generation libraries (ReportLab/WeasyPrint)
        are not available; the file is delivered as a downloadable text report.
        """
        lines = [f"4VELO Export: {data.get('resource', resource)}", "=" * 50, ""]
        stats = data.get('data', {})
        if isinstance(stats, dict):
            for key, value in stats.items():
                lines.append(f"  {key}: {value}")
        elif isinstance(stats, list):
            for item in stats:
                lines.append(f"  - {item}")
        else:
            lines.append(str(stats))
        lines.append("")
        lines.append(f"Generated: {timezone.now().isoformat()}")
        body = "\r\n".join(lines)
        response = HttpResponse(body, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{resource}.pdf"'
        return response

    def _export_activities(self, fmt):
        qs = Activity.objects.select_related('user').all()[:10000]
        activities = []
        for a in qs:
            activities.append({
                'id': a.id,
                'user': a.user.username,
                'type': a.type,
                'start_time': str(a.start_time),
                'end_time': str(a.end_time) if a.end_time else None,
                'distance_m': a.distance,
                'is_verified': a.is_verified,
                'verification_score': a.verification_score,
            })
        return {'resource': 'activities', 'format': fmt, 'count': len(activities), 'data': activities}

    def _export_users(self, fmt):
        User = get_user_model()
        qs = User.objects.all()[:10000]
        users = []
        for u in qs:
            users.append({
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'role': u.role,
                'tenant_id': str(u.tenant_id) if u.tenant_id else None,
                'date_joined': str(u.date_joined),
            })
        return {'resource': 'users', 'format': fmt, 'count': len(users), 'data': users}

    def _export_statistics(self, fmt):
        total_activities = Activity.objects.count()
        total_users = get_user_model().objects.count()
        total_distance = Activity.objects.aggregate(Sum('distance'))['distance__sum'] or 0
        verified = Activity.objects.filter(is_verified=True).count()
        return {
            'resource': 'statistics',
            'format': fmt,
            'data': {
                'total_activities': total_activities,
                'total_users': total_users,
                'total_distance_km': round(float(total_distance) / 1000.0, 1),
                'verified_count': verified,
                'verified_pct': round(verified / max(total_activities, 1) * 100, 1),
            }
        }


class LiveSimulationView(APIView):
    """
    POST   /api/activities/admin/live-simulate/   — start live ride simulation
    GET    /api/activities/admin/live-simulate/   — status + logs + stats
    DELETE /api/activities/admin/live-simulate/   — abort
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        sim.heal_stale_live_simulation(reschedule=True)
        sim.maybe_advance_live_simulation()
        state = sim.get_live_state()
        log = sim.get_live_log()
        elapsed = 0.0
        if state.get('started_at'):
            elapsed = time.time() - state['started_at']
        pool_size = sim.get_live_pool_count()
        active_rides = sim.get_live_ride_count()
        live_lock = sim.is_live_lock_held()
        stuck = sim.live_simulation_stuck()
        tick_stale = sim.live_tick_stale() if state['running'] else False
        batch_blocked, batch_block_reason = sim.batch_blocks_live_simulation()
        return Response({
            'running': state['running'],
            'batch_blocks_live': batch_blocked,
            'batch_block_reason': batch_block_reason or None,
            'elapsed_seconds': round(elapsed, 1),
            'error': state.get('error'),
            'stuck': stuck,
            'tick_stale': tick_stale,
            'worker_recovered_at': state.get('worker_recovered_at'),
            'live_lock_held': live_lock,
            'pool_size': pool_size,
            'active_rides': active_rides,
            'total_users': int(state['total_users']),
            'active_ratio': float(state['active_ratio']),
            'cheat_ratio': float(state['cheat_ratio']),
            'tick_seconds': state['tick_seconds'],
            'currently_riding': state['currently_riding'],
            'total_completed': state['total_completed'],
            'cheaters_caught': state['cheaters_caught'],
            'log': log,
        })

    def delete(self, request):
        sim.force_stop_live_simulation()
        return Response({
            'status': 'stopped',
            'live_lock_held': sim.is_live_lock_held(),
            'message': 'Live simulation stopped and locks cleared.',
        })

    def post(self, request):
        from activities import wipe_state as ws
        if ws.is_wipe_in_progress():
            return Response(
                {
                    'error': 'Wipe is in progress. Starting live simulation is temporarily blocked.',
                    'code': 'WIPE_IN_PROGRESS',
                },
                status=status.HTTP_409_CONFLICT,
            )
        state = sim.get_live_state()
        if state['running']:
            return Response({'error': 'Live simulation already running.'}, status=status.HTTP_409_CONFLICT)

        blocked, block_reason = sim.batch_blocks_live_simulation()
        if blocked:
            batch = sim.get_batch_state()
            return Response(
                {
                    'error': (
                        'Batch simulation is still in progress. Wait until it finishes '
                        '(phase complete, lock released), then start Live Map.'
                    ),
                    'batch_running': bool(batch.get('running')),
                    'batch_lock_held': sim.is_batch_lock_held(),
                    'batch_current_phase': batch.get('current_phase'),
                    'batch_block_reason': block_reason,
                },
                status=status.HTTP_409_CONFLICT,
            )

        pool_pct = float(request.data.get('pool_pct', 0.5))
        active_ratio = float(request.data.get('active_ratio', 0.3))
        cheat_ratio = float(request.data.get('cheat_ratio', 0.05))
        tick_seconds = int(request.data.get('tick_seconds', 10))

        if active_ratio <= 0 or active_ratio > 1:
            return Response({'error': 'active_ratio must be 0–1'}, status=400)
        if cheat_ratio < 0 or cheat_ratio > 1:
            return Response({'error': 'cheat_ratio must be 0–1'}, status=400)
        if tick_seconds < 2 or tick_seconds > 300:
            return Response({'error': 'tick_seconds must be 2–300'}, status=400)

        # Validate athlete pool
        validation = sim.validate_athlete_pool(min_users=10)
        if not validation['has_athletes']:
            seeded = _bootstrap_live_athletes(min_users=500)
            validation = sim.validate_athlete_pool(min_users=10)
            if not validation['has_athletes']:
                return Response({
                    'error': validation['error'],
                    'bootstrap_attempted': True,
                    'athletes_after_bootstrap': seeded.get('total', 0),
                }, status=status.HTTP_400_BAD_REQUEST)

        # Calculate actual user count from pool percentage
        from users.models import User
        total_athletes = User.objects.filter(role='ATHLETE').count()
        total_users = max(10, int(total_athletes * pool_pct))

        # Spawn Celery task or run synchronously on SQLite
        if 'sqlite' in os.getenv('DATABASE_URL', ''):
            blocked, block_reason = sim.batch_blocks_live_simulation()
            if blocked:
                return Response(
                    {
                        'error': 'Batch simulation is still in progress.',
                        'batch_block_reason': block_reason,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            sim.reset_live_state()
            sim.set_live_state(
                running=True, started_at=time.time(),
                total_users=total_users, active_ratio=active_ratio,
                cheat_ratio=cheat_ratio, tick_seconds=tick_seconds,
                currently_riding=0, total_completed=0, cheaters_caught=0,
                last_tick_at=time.time()
            )
            # Setup athlete pool
            from activities.scale_config import compute_batch_scaling
            pool_plan = compute_batch_scaling(max(total_users, 1))
            if pool_plan['live_pool_mode'] == 'db':
                pool_size = sim.init_live_pool_db_mode(total_users)
            else:
                pool_size = sim.set_live_pool_from_db(pool_plan['live_pool_redis_cap'])
            sim.set_live_state(total_users=pool_size)
            sim.live_log(f"LIVE SIM (SQLite De-blocked Mode): pool={pool_size} users.")
            
            # Run first tick immediately, then keep ticking in background (no Celery countdown in eager mode)
            from .simulator_tasks import live_tick_task
            live_tick_task.delay()
            sim.start_live_tick_loop()
        else:
            if sim.is_live_lock_held() and not state['running']:
                sim.release_live_lock()
            if not sim.acquire_live_lock():
                return Response(
                    {
                        'error': 'Live simulation lock is held. Use Stop or Reset Simulator.',
                        'live_lock_held': True,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            blocked, block_reason = sim.batch_blocks_live_simulation()
            if blocked:
                sim.release_live_lock()
                batch = sim.get_batch_state()
                return Response(
                    {
                        'error': 'Batch simulation is still in progress (live start aborted).',
                        'batch_block_reason': block_reason,
                        'batch_running': bool(batch.get('running')),
                        'batch_lock_held': sim.is_batch_lock_held(),
                        'batch_current_phase': batch.get('current_phase'),
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            sim.reset_live_state()
            sim.set_live_state(
                running=True, started_at=time.time(),
                total_users=total_users, active_ratio=active_ratio,
                cheat_ratio=cheat_ratio, tick_seconds=tick_seconds,
                currently_riding=0, total_completed=0, cheaters_caught=0,
                last_tick_at=time.time(), error=None,
            )
            run_live_simulation.delay()

        return Response({
            'status': 'started',
            'running': True,
            'total_users': total_users,
            'active_ratio': active_ratio,
            'cheat_ratio': cheat_ratio,
            'tick_seconds': tick_seconds,
            'message': f'Live simulation: {total_users} users, {active_ratio*100:.0f}% active, {cheat_ratio*100:.0f}% cheaters',
        })


class WipeDataView(APIView):
    """
    DELETE /api/activities/admin/wipe-data/  — start chunked async wipe
    GET    /api/activities/admin/wipe-data/  — progress { running, progress_pct, deleted, log }
    """
    permission_classes = [IsGlobalOwner]

    def get(self, request):
        from activities import wipe_state as ws
        state = ws.get_wipe_state()
        label = ws.wipe_status_label(state)
        stuck = ws.is_wipe_stuck(state)
        return Response({
            **state,
            'status': label,
            'stuck': stuck,
            'log': ws.get_wipe_log(),
        })

    def delete(self, request):
        confirm = request.data.get('confirm', False) or request.query_params.get('confirm') == 'true'
        if not confirm:
            return Response({'error': 'Must send ?confirm=true'}, status=status.HTTP_400_BAD_REQUEST)

        # Strong guard rails: exact phrase + MFA-like checkbox acknowledgement.
        # Phrase includes environment to prevent accidental cross-environment wipes.
        expected_env = 'development' if getattr(django_settings, 'DEBUG', False) else 'production'
        expected_phrase = f'DELETE ALL DATA — {expected_env.upper()} — GLOBAL_OWNER'

        confirm_phrase = (request.data.get('confirm_phrase') or '').strip()
        if confirm_phrase != expected_phrase:
            return Response(
                {'error': 'Invalid confirmation phrase. Re-open the dialog and confirm exactly as shown.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mfa_confirmed = bool(request.data.get('mfa_confirmed', False))
        if not mfa_confirmed:
            return Response(
                {'error': 'Missing MFA-like confirmation checkbox (mfa_confirmed=true).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from activities import wipe_state as ws
        from activities.wipe_tasks import start_wipe_async
        from activities import simulator_state as sim

        force = (
            request.data.get('force', False)
            or str(request.query_params.get('force', '')).lower() in ('1', 'true', 'yes')
        )
        state = ws.get_wipe_state()
        if state.get('running'):
            if force or ws.is_wipe_stuck(state):
                ws.force_reset_wipe()
                ws.wipe_log('Stale wipe state cleared — starting new wipe.')
            else:
                return Response(
                    {
                        **state,
                        'status': ws.wipe_status_label(state),
                        'stuck': False,
                        'message': 'Wipe already running. Returning current job state.',
                        'hint': 'Poll GET /admin/wipe-data/ until complete. Retry force=true only for stale jobs.',
                    },
                    status=status.HTTP_202_ACCEPTED,
                )

        # Audit log for the wipe action (queued).
        from users.models import AuditLog
        AuditLog.objects.create(
            impersonator=request.user,
            target_user=request.user,
            tenant_id=None,
            action='WIPE ALL DATA queued',
            ip_address=request.META.get('REMOTE_ADDR'),
            status_code=202,
        )

        ws.mark_wipe_queued()
        # Immediate quiesce barrier: stop both sim modes before heavy deletes begin.
        ws.set_wipe_in_progress(True)
        sim.force_stop_live_simulation()
        sim.force_stop_batch_simulation()
        dispatch = start_wipe_async()
        return Response({
            'status': 'queued',
            'running': True,
            'dispatch': dispatch,
            'message': 'Chunked wipe running in background. Poll GET /admin/wipe-data/ for progress.',
        }, status=status.HTTP_202_ACCEPTED)


class SimulatorResetView(APIView):
    """
    POST /api/activities/admin/simulator-reset/
    Emergency: clear batch/live locks and running flags without deleting data.
    """
    permission_classes = [IsAdminRole]

    def post(self, request):
        from activities import wipe_state as ws

        sim.reset_simulator_locks()
        ws.force_reset_wipe()
        return Response({
            'status': 'reset',
            'live_lock_held': sim.is_live_lock_held(),
            'batch_lock_held': sim.is_batch_lock_held(),
            'live_stuck': sim.live_simulation_stuck(),
            'wipe_cleared': True,
        })


class WorkerStatusView(APIView):
    """
    GET /api/activities/admin/worker-status/
    Returns Celery worker info: active workers, queues, stats.
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        try:
            from core.celery import app
            insp = app.control.inspect()

            result = {
                'workers': [],
                'total_workers': 0,
                'active_tasks': 0,
                'queues': [],
            }

            stats = insp.stats()
            active = insp.active()
            reserved = insp.reserved()
            scheduled = insp.scheduled()
            registered = insp.registered()

            if stats:
                for worker_name, worker_stats in stats.items():
                    total_raw = worker_stats.get('total', 0)
                    total_count = sum(total_raw.values()) if isinstance(total_raw, dict) else int(total_raw or 0)
                    worker_info = {
                        'name': worker_name,
                        'pool_size': worker_stats.get('pool', {}).get('max-concurrency', 0) if isinstance(worker_stats.get('pool'), dict) else 0,
                        'total_tasks': total_count,
                    }
                    result['workers'].append(worker_info)

            result['total_workers'] = len(result['workers'])

            # Count active tasks
            if active:
                for worker_name, tasks in active.items():
                    result['active_tasks'] += len(tasks)

            # Discover active queues from worker registrations
            if registered:
                all_queues = set()
                for worker_name, task_list in registered.items():
                    # registered returns list of task names, not queues
                    pass

            # Get active queues from inspect active_queues
            active_queues = insp.active_queues()
            if active_queues:
                for worker_name, queues in active_queues.items():
                    for q in queues:
                        if q.get('name') not in result['queues']:
                            result['queues'].append(q.get('name'))

            return Response(result)

        except Exception as exc:
            import logging
            logger = logging.getLogger('activities')
            logger.error(f"Worker status check failed: {exc}")
            return Response({
                'workers': [],
                'total_workers': 0,
                'active_tasks': 0,
                'queues': [],
                'error': str(exc),
            }, status=status.HTTP_200_OK)  # Don't fail — show empty state


class DiskAuditListView(APIView):
    """
    GET /api/activities/admin/disk-audit/?limit=100
    Read-only disk guard audit log.
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        from activities.models import DiskAuditEvent
        from activities.scale_disk_monitor import (
            are_sim_writes_blocked,
            get_disk_usage_snapshot,
            is_simulation_paused,
        )

        try:
            limit = min(500, max(1, int(request.query_params.get('limit', 100))))
        except (TypeError, ValueError):
            limit = 100

        rows = DiskAuditEvent.objects.order_by('-created_at')[:limit]
        events = [
            {
                'id': e.id,
                'timestamp': e.created_at.isoformat(),
                'event_type': e.event_type,
                'used_gb': e.used_gb,
                'budget_gb': e.budget_gb,
                'pct': e.pct,
                'action_taken': e.action_taken,
                'source': e.source,
            }
            for e in rows
        ]
        snap = get_disk_usage_snapshot()
        return Response({
            'events': events,
            'current': {
                **snap,
                'simulation_paused': is_simulation_paused(),
                'writes_blocked': are_sim_writes_blocked(),
            },
        })


class ScalePreflightView(APIView):
    """
    GET /api/activities/admin/scale-preflight/?target_users=300000&active_ratio=0.3
    Analyse risks before a large-scale load test.
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        from activities.scale_preflight import analyze_scale
        try:
            target = int(request.query_params.get('target_users', 1000))
        except (TypeError, ValueError):
            return Response({'error': 'target_users must be an integer'}, status=400)
        try:
            active_ratio = float(request.query_params.get('active_ratio', 0.3))
        except (TypeError, ValueError):
            active_ratio = 0.3
        skip_activities = request.query_params.get('skip_activities', 'false').lower() in ('1', 'true', 'yes')
        event_day = request.query_params.get('event_day', '').lower() in ('1', 'true', 'yes')
        return Response(analyze_scale(
            target_users=target,
            active_ratio=active_ratio,
            skip_activities=skip_activities,
            generate_activities=not skip_activities,
            event_day=event_day if event_day else None,
        ))


class RunSimulationView(APIView):
    """
    POST   /api/activities/admin/simulate/        — start batch simulation
    GET    /api/activities/admin/simulate/        — status + logs
    DELETE /api/activities/admin/simulate/        — abort
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        try:
            state = sim.get_batch_state()
            log = sim.get_batch_log()
        except Exception as exc:
            return Response(
                {'error': f'Simulator state unavailable: {exc}', 'running': False, 'log': []},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        elapsed = 0.0
        started = state.get('started_at')
        if started:
            end = state.get('completed_at') or time.time()
            elapsed = end - started

        batch_lock = sim.is_batch_lock_held()
        stuck = batch_lock and not state['running']
        return Response({
            'running': state['running'],
            'elapsed_seconds': round(elapsed, 1),
            'scale': state['scale'],
            'days': state['days'],
            'error': state.get('error'),
            'stuck': stuck or bool(state.get('error')),
            'batch_lock_held': batch_lock,
            'total_users': int(state['total_users']),
            'users_created': state['users_created'],
            'departments_created': state['departments_created'],
            'activities_created': state['activities_created'],
            'current_phase': state['current_phase'],
            'progress_pct': state['progress_pct'],
            'log': log,
        })

    def delete(self, request):
        sim.force_stop_batch_simulation()
        return Response({
            'status': 'abort_requested',
            'batch_lock_held': sim.is_batch_lock_held(),
            'message': 'Batch simulation stopped and lock cleared.',
        })

    def post(self, request):
        from activities import wipe_state as ws
        if ws.is_wipe_in_progress():
            return Response(
                {
                    'error': 'Wipe is in progress. Starting batch simulation is temporarily blocked.',
                    'code': 'WIPE_IN_PROGRESS',
                },
                status=status.HTTP_409_CONFLICT,
            )
        state = sim.get_batch_state()
        if state['running']:
            elapsed = time.time() - (state['started_at'] or 0)
            return Response({
                'error': f'Simulation already running ({elapsed:.0f}s elapsed). Wait for it to finish.',
                'running': True,
                'elapsed_seconds': round(elapsed, 1),
            }, status=status.HTTP_409_CONFLICT)

        scale = float(request.data.get('scale', 0.01))
        days = int(request.data.get('days', 30))
        clear = bool(request.data.get('clear', False))
        skip_activities = bool(request.data.get('skip_activities', False))
        total_users = request.data.get('total_users')
        if total_users is not None:
            try:
                total_users = int(total_users)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'total_users must be an integer'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            from activities.scale_config import MAX_BATCH_USERS, FORCE_SKIP_ACTIVITIES_ABOVE
            if total_users > MAX_BATCH_USERS:
                return Response(
                    {'error': f'total_users exceeds limit ({MAX_BATCH_USERS:,})'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if total_users >= FORCE_SKIP_ACTIVITIES_ABOVE and not skip_activities:
                skip_activities = True
                sim.batch_log(
                    f"Auto skip_activities for {total_users:,} users (scale safety)."
                )

        if not total_users and (scale < 0.001 or scale > 1.0):
            return Response(
                {'error': 'scale must be between 0.001 and 1.0'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from activities.scale_disk_monitor import check_simulation_allowed, run_disk_monitor

        run_disk_monitor(source='preflight')
        allowed, guard_reason = check_simulation_allowed('preflight')
        if not allowed:
            return Response(
                {'error': guard_reason, 'disk_guard': True},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Reset and mark running=True explicitly to prevent frontend polling race conditions in async environments
        sim.reset_batch_state()
        sim.set_batch_state(
            running=True, current_phase='starting', progress_pct=0,
            users_created=0, activities_created=0, started_at=time.time(),
            scale=scale, days=days, total_users=total_users or 0
        )

        batch_plan = None
        est_message = f'Batch simulation started. Estimated time: ~{int(scale * 30)} minutes.'
        batch_warnings: list[str] = []
        if total_users:
            from activities.scale_config import compute_batch_scaling
            from django.contrib.auth import get_user_model

            batch_plan = compute_batch_scaling(int(total_users))
            eta_min = max(1, batch_plan['estimated_batch_seconds'] // 60)
            est_message = (
                f"Batch started: {batch_plan['num_cities']} cities × "
                f"{batch_plan['users_per_city']:,} users, "
                f"pg chunk {batch_plan['user_bulk_pg_batch_size']:,}, "
                f"ETA ~{eta_min} min (skip_activities={skip_activities})."
            )
            sim.batch_log(est_message)
            from activities.scale_config import AUTO_DISK_GUARD
            if AUTO_DISK_GUARD:
                from activities.scale_disk_guard import get_database_size_gb, resolve_disk_budget_gb
                db_gb = get_database_size_gb()
                budget, src = resolve_disk_budget_gb(db_gb)
                batch_warnings.append(
                    f"Dysk: auto guard (~{budget:g} GB, {src}), wipe + chunki w workerze."
                )
            else:
                disk_gb = batch_plan.get('estimated_disk_gb', 0)
                if disk_gb >= 0.5:
                    batch_warnings.append(
                        f"Szacowany dysk Postgres: ~{disk_gb:.1f} GB przy tym batchu."
                    )

        # Spawn Celery task
        run_batch_simulation.delay(
            scale=scale,
            days=days,
            clear=clear,
            skip_activities=skip_activities,
            total_users=total_users,
        )

        payload = {
            'status': 'started',
            'running': True,
            'scale': scale,
            'days': days,
            'clear': clear,
            'skip_activities': skip_activities,
            'message': est_message,
        }
        if batch_plan:
            payload['batch_plan'] = batch_plan
        if batch_warnings:
            payload['warnings'] = batch_warnings
        return Response(payload)

