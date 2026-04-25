from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework.pagination import PageNumberPagination
from .models import Activity
from .serializers import ActivitySerializer


class IsAdminRole(permissions.BasePermission):
    """
    Allows access only to Global Admins, Owners, or Local Moderators.
    Acts as the first line of defence before queryset filtering.
    """
    ALLOWED_ROLES = ('GLOBAL_ADMIN', 'OWNER', 'LOCAL_MODERATOR')

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
    List all activities for Global Administrators.
    """
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    pagination_class = ActivityPagination

    def get_queryset(self):
        if self.request.user.role in ('GLOBAL_ADMIN', 'OWNER'):
            return Activity.objects.select_related('user').all()
        return Activity.objects.none()

class TenantActivityListView(generics.ListAPIView):
    """
    List activities for Local Moderators (limited to their tenant).
    """
    serializer_class = ActivitySerializer
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    pagination_class = ActivityPagination

    def get_queryset(self):
        if self.request.user.role == 'LOCAL_MODERATOR' and self.request.user.tenant_id:
            return Activity.objects.filter(
                user__tenant_id=self.request.user.tenant_id
            ).select_related('user')
        return Activity.objects.none()


class AdminDashboardStatsView(APIView):
    """
    Returns high-level platform KPIs for the admin dashboard.
    """
    permission_classes = (permissions.AllowAny,) # Should be IsAdminRole in prod

    def get(self, request):
        User = get_user_model()
        total_users = User.objects.count()
        total_activities = Activity.objects.count()
        total_distance = Activity.objects.aggregate(Sum('distance'))['distance__sum'] or 0
        total_calories = 0 # Field not yet in model

        return Response({
            "total_users": total_users,
            "total_activities": total_activities,
            "total_distance_km": float(total_distance / 1000.0), # Convert m to km
            "total_calories": total_calories,
            "new_users_today": total_users
        })

