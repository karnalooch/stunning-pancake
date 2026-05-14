from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import Tenant

from .models import Activity
from .serializers import ActivitySerializer


class IsAdminRole(permissions.BasePermission):
    """
    Allows access only to Global Owners, Tenant Admins, or Tenant Moderators.
    Matches the actual User.Role choices defined in users/models.py.
    """
    ALLOWED_ROLES = ('GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR')

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', None) in self.ALLOWED_ROLES
        )


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

        per_tenant_stats = []
        for tenant in Tenant.objects.filter(is_active=True):
            tenant_users = User.objects.filter(tenant=tenant).count()
            tenant_activities = Activity.objects.filter(tenant=tenant)
            tenant_act_count = tenant_activities.count()
            tenant_distance = tenant_activities.aggregate(Sum('distance'))['distance__sum'] or 0
            tenant_verified = tenant_activities.filter(is_verified=True).count()
            tenant_verification_rate = round((tenant_verified / tenant_act_count * 100), 1) if tenant_act_count > 0 else 0.0

            per_tenant_stats.append({
                "tenant_id": str(tenant.id),
                "tenant_name": tenant.name,
                "users": tenant_users,
                "activities": tenant_act_count,
                "distance_km": round(float(tenant_distance / 1000.0), 1),
                "verified_pct": tenant_verification_rate,
                "primary_color": tenant.primary_color,
                "secondary_color": tenant.secondary_color,
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
        })


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

