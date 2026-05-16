import csv
import io
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

        tenant_qs = Tenant.objects.filter(is_active=True).annotate(
            user_count=Count('users'),
            activity_count=Count('activities'),
            total_distance=Sum('activities__distance'),
            verified_count=Count('activities', filter=Q(activities__is_verified=True)),
        )

        per_tenant_stats = []
        for t in tenant_qs:
            act_count = t.activity_count or 0
            dist = t.total_distance or 0
            verified = t.verified_count or 0
            ver_rate = round((verified / act_count * 100), 1) if act_count > 0 else 0.0
            per_tenant_stats.append({
                "tenant_id": str(t.id),
                "tenant_name": t.name,
                "users": t.user_count,
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

