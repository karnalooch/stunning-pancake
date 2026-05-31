import csv
import io
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
from datetime import timedelta
from rest_framework.pagination import PageNumberPagination
from .models import Activity
from .serializers import ActivitySerializer
from users.models import Tenant
from users.permissions import IsAdminOrModerator
from . import simulator_state as sim
from .simulator_tasks import run_batch_simulation, run_live_simulation

# Keep IsAdminRole as an alias for backward compatibility
IsAdminRole = IsAdminOrModerator


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
    """
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def get(self, request):
        User = get_user_model()
        now = timezone.now()
        seven_days_ago = now - timedelta(days=7)

        total_users = User.objects.count()
        total_activities = Activity.objects.count()
        total_distance = Activity.objects.aggregate(Sum('distance'))['distance__sum'] or 0
        total_distance_km = round(float(total_distance / 1000.0), 1)

        # Approximate calories: 50 kcal per km (cycling/running mix)
        total_calories = int(total_distance_km * 50)

        new_users_today = User.objects.filter(date_joined__gte=now.replace(hour=0, minute=0, second=0)).count()
        new_users_last_7d = User.objects.filter(date_joined__gte=seven_days_ago).count()
        new_activities_last_7d = Activity.objects.filter(created_at__gte=seven_days_ago).count()

        total_verified = Activity.objects.filter(is_verified=True).count()
        verified_pct = round((total_verified / total_activities * 100), 1) if total_activities > 0 else 0.0

        tenant_qs = Tenant.objects.filter(is_active=True)

        per_tenant_stats = []
        for t in tenant_qs:
            user_count = t.users.count()
            activities = t.activities.all()
            act_count = activities.count()
            dist = activities.aggregate(Sum('distance'))['distance__sum'] or 0
            verified = activities.filter(is_verified=True).count()
            ver_rate = round((verified / act_count * 100), 1) if act_count > 0 else 0.0
            per_tenant_stats.append({
                "tenant_id": str(t.id),
                "tenant_name": t.name,
                "users": user_count,
                "activities": act_count,
                "distance_km": round(float(dist / 1000.0), 1),
                "verified_pct": ver_rate,
                "primary_color": t.primary_color,
                "secondary_color": t.secondary_color,
            })

        # Per-department stats (for tenant admins)
        per_dept_stats = []
        if request.user.role in ('TENANT_ADMIN', 'TENANT_MODERATOR') and request.user.tenant_id:
            from users.departments import Department
            for dept in Department.objects.filter(tenant_id=request.user.tenant_id, is_active=True):
                dept_user_ids = dept.members.values_list('id', flat=True)
                dept_activities = Activity.objects.filter(user_id__in=dept_user_ids)
                dept_act_count = dept_activities.count()
                dept_distance = dept_activities.aggregate(Sum('distance'))['distance__sum'] or 0
                dept_verified = dept_activities.filter(is_verified=True).count()
                per_dept_stats.append({
                    "department_id": dept.id,
                    "department_name": dept.name,
                    "users": dept.members.count(),
                    "activities": dept_act_count,
                    "distance_km": round(float(dept_distance / 1000.0), 1),
                    "verified_pct": round((dept_verified / dept_act_count * 100), 1) if dept_act_count > 0 else 0.0,
                })

        return Response({
            "total_users": total_users,
            "total_activities": total_activities,
            "total_distance_km": total_distance_km,
            "total_calories": total_calories,
            "new_users_today": new_users_today,
            "new_users_last_7d": new_users_last_7d,
            "new_activities_last_7d": new_activities_last_7d,
            "verified_total": total_verified,
            "verified_pct": verified_pct,
            "unverified_total": total_activities - total_verified,
            "per_tenant": per_tenant_stats,
            "per_department": per_dept_stats,
        })


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
            activity = Activity.objects.get(pk=activity_id)
            activity.is_verified = True
            activity.verification_score = 1.0
            activity.save()
            return Response({
                "status": "approved",
                "activity_id": activity.id,
                "user": activity.user.username,
                "verification_score": activity.verification_score,
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
        state = sim.get_live_state()
        log = sim.get_live_log()
        elapsed = 0.0
        if state.get('started_at'):
            elapsed = time.time() - state['started_at']
        return Response({
            'running': state['running'],
            'elapsed_seconds': round(elapsed, 1),
            'error': state.get('error'),
            'total_users': state['total_users'],
            'active_ratio': state['active_ratio'],
            'cheat_ratio': state['cheat_ratio'],
            'tick_seconds': state['tick_seconds'],
            'currently_riding': state['currently_riding'],
            'total_completed': state['total_completed'],
            'cheaters_caught': state['cheaters_caught'],
            'log': log,
        })

    def delete(self, request):
        state = sim.get_live_state()
        if not state['running']:
            return Response({'error': 'No live simulation running.'}, status=status.HTTP_400_BAD_REQUEST)
        sim.set_live_state(running=False)
        sim.live_log("⚠️ Stopped by user.")
        return Response({'status': 'stopped'})

    def post(self, request):
        state = sim.get_live_state()
        if state['running']:
            return Response({'error': 'Live simulation already running.'}, status=status.HTTP_409_CONFLICT)

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
            return Response({'error': validation['error']}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate actual user count from pool percentage
        from users.models import User
        total_athletes = User.objects.filter(role='ATHLETE').count()
        total_users = max(10, int(total_athletes * pool_pct))

        # Spawn Celery task
        run_live_simulation.delay(
            total_users=total_users,
            active_ratio=active_ratio,
            cheat_ratio=cheat_ratio,
            tick_seconds=tick_seconds,
        )

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
    DELETE /api/activities/admin/wipe-data/?confirm=true
    Deletes ALL data except GLOBAL_OWNER users.
    """
    permission_classes = [IsAdminRole]

    def delete(self, request):
        from django.db import connection
        confirm = request.data.get('confirm', False) or request.query_params.get('confirm') == 'true'
        if not confirm:
            return Response({'error': 'Must send ?confirm=true'}, status=status.HTTP_400_BAD_REQUEST)

        from users.models import User, Tenant
        from users.departments import Department, UserDepartment
        from activities.models import Activity

        deleted = {}
        models_in_order = [
            (Activity, 'activities'),
            (Department, 'departments'),
            (UserDepartment, 'user_departments'),
        ]
        for model, label in models_in_order:
            try:
                deleted[label] = model.objects.all().delete()[0]
            except Exception as e:
                deleted[label] = f'error: {e}'

        # Users except GLOBAL_OWNER
        try:
            deleted['users'] = User.objects.exclude(role='GLOBAL_OWNER').delete()[0]
        except Exception as e:
            deleted['users'] = f'error: {e}'

        # Tenants
        try:
            deleted['tenants'] = Tenant.objects.all().delete()[0]
        except Exception as e:
            deleted['tenants'] = f'error: {e}'

        # Ensure global_owner exists
        owner, created = User.objects.get_or_create(
            username='global_owner',
            defaults={'email': 'owner@4velo.app', 'role': 'GLOBAL_OWNER', 'is_superuser': True, 'is_staff': True},
        )
        owner.set_password(os.getenv('GLOBAL_OWNER_PASSWORD', 'admin123'))
        owner.is_superuser = True
        owner.is_staff = True
        owner.role = 'GLOBAL_OWNER'
        owner.save()

        # Also reset simulator state
        sim.reset_batch_state()
        sim.reset_live_state()

        return Response({
            'status': 'wiped',
            'deleted': {k: v for k, v in deleted.items() if isinstance(v, int)},
            'message': 'Login: global_owner / admin123',
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


class RunSimulationView(APIView):
    """
    POST   /api/activities/admin/simulate/        — start batch simulation
    GET    /api/activities/admin/simulate/        — status + logs
    DELETE /api/activities/admin/simulate/        — abort
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        state = sim.get_batch_state()
        log = sim.get_batch_log()
        elapsed = 0.0
        if state.get('started_at'):
            end = state['completed_at'] or time.time()
            elapsed = end - state['started_at']

        return Response({
            'running': state['running'],
            'elapsed_seconds': round(elapsed, 1),
            'scale': state['scale'],
            'days': state['days'],
            'error': state.get('error'),
            'total_users': state['total_users'],
            'users_created': state['users_created'],
            'departments_created': state['departments_created'],
            'activities_created': state['activities_created'],
            'current_phase': state['current_phase'],
            'progress_pct': state['progress_pct'],
            'log': log,
        })

    def delete(self, request):
        state = sim.get_batch_state()
        if not state['running']:
            return Response({'error': 'No simulation is currently running.'}, status=status.HTTP_400_BAD_REQUEST)
        sim.set_batch_state(running=False)
        sim.batch_log("⚠️ Abort requested by user.")
        return Response({'status': 'abort_requested', 'message': 'Simulation will stop at the next checkpoint.'})

    def post(self, request):
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

        if not total_users and (scale < 0.001 or scale > 1.0):
            return Response(
                {'error': 'scale must be between 0.001 and 1.0'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Spawn Celery task
        run_batch_simulation.delay(
            scale=scale,
            days=days,
            clear=clear,
            skip_activities=skip_activities,
            total_users=total_users,
        )

        return Response({
            'status': 'started',
            'running': True,
            'scale': scale,
            'days': days,
            'clear': clear,
            'skip_activities': skip_activities,
            'message': f'Batch simulation started. Estimated time: ~{int(scale * 30)} minutes.',
        })

