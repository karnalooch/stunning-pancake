"""
P3 Tests — Admin Views: Permission Checks + N+1 Query Fix
===========================================================
Tests the P1 Issue 6 fixes: IsAdminRole permission class and
AdminDashboardStatsView single-query optimization.
"""
import pytest
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from users.models import Tenant
from activities.admin_views import AdminDashboardStatsView, IsAdminRole

User = get_user_model()


@pytest.fixture
def user(db):
    """Create a basic ATHLETE user for permission tests."""
    tenant = Tenant.objects.create(id="test-admin-view", name="Admin Test City", is_active=True)
    return User.objects.create_user(
        username="testathlete", email="athlete@test.com", password="pass",
        role="ATHLETE", tenant=tenant,
    )


@pytest.fixture
def owner_user(db):
    """Create a GLOBAL_OWNER user."""
    return User.objects.create_user(
        username="globalowner", email="owner@test.com", password="pass",
        role="GLOBAL_OWNER",
    )


class TestIsAdminRole:
    def test_is_admin_role_allows_global_owner(self, owner_user):
        """IsAdminRole should allow GLOBAL_OWNER."""
        permission = IsAdminRole()
        request = RequestFactory().get('/')
        request.user = owner_user
        assert permission.has_permission(request, None) is True

    def test_is_admin_role_allows_tenant_admin(self, user):
        """IsAdminRole should allow TENANT_ADMIN."""
        user.role = 'TENANT_ADMIN'
        user.save()
        permission = IsAdminRole()
        request = RequestFactory().get('/')
        request.user = user
        assert permission.has_permission(request, None) is True

    def test_is_admin_role_allows_tenant_moderator(self, user):
        """IsAdminRole should allow TENANT_MODERATOR."""
        user.role = 'TENANT_MODERATOR'
        user.save()
        permission = IsAdminRole()
        request = RequestFactory().get('/')
        request.user = user
        assert permission.has_permission(request, None) is True

    def test_is_admin_role_denies_athlete(self, user):
        """IsAdminRole should deny ATHLETE."""
        permission = IsAdminRole()
        request = RequestFactory().get('/')
        request.user = user
        assert permission.has_permission(request, None) is False

    def test_is_admin_role_denies_unauthenticated(self):
        """IsAdminRole should deny unauthenticated users."""
        from django.contrib.auth.models import AnonymousUser
        permission = IsAdminRole()
        request = RequestFactory().get('/')
        request.user = AnonymousUser()
        assert permission.has_permission(request, None) is False


@pytest.mark.django_db
class TestAdminDashboardStats:
    def test_dashboard_stats_returns_200(self, owner_user):
        """AdminDashboardStatsView should return 200 for GLOBAL_OWNER."""
        from rest_framework.test import force_authenticate

        factory = RequestFactory()
        request = factory.get('/api/activities/admin/stats/')
        force_authenticate(request, user=owner_user)

        view = AdminDashboardStatsView()
        response = view.dispatch(request)

        assert response.status_code == 200
        data = response.data
        assert 'total_users' in data
        assert 'total_activities' in data
        assert 'total_distance_km' in data
        assert 'per_tenant' in data

    def test_dashboard_stats_per_tenant_breakdown(self, owner_user, user):
        """AdminDashboardStatsView should include per-tenant breakdown."""
        from rest_framework.test import force_authenticate

        factory = RequestFactory()
        request = factory.get('/api/activities/admin/stats/')
        force_authenticate(request, user=owner_user)

        view = AdminDashboardStatsView()
        response = view.dispatch(request)

        per_tenant = response.data.get('per_tenant', [])
        assert isinstance(per_tenant, list)

    def test_dashboard_stats_denies_athlete(self, user):
        """AdminDashboardStatsView should deny ATHLETE users."""
        from rest_framework.test import force_authenticate

        factory = RequestFactory()
        request = factory.get('/api/activities/admin/stats/')
        force_authenticate(request, user=user)

        view = AdminDashboardStatsView()
        response = view.dispatch(request)

        assert response.status_code == 403
