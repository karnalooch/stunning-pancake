"""
P0 Tests — Admin Dashboard Stats & Activity Moderation
=======================================================
RC v0.2 critical paths: stats endpoint, approve/reject flow.
"""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from activities.models import Activity
from users.models import Tenant

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def tenant(db):
    return Tenant.objects.create(id="test-city", name="Test City", is_active=True)


@pytest.fixture
def tenant2(db):
    return Tenant.objects.create(id="test-city-2", name="Second City", is_active=True)


@pytest.fixture
def owner_user(db):
    return User.objects.create_user(
        username="owner",
        email="owner@test.com",
        password="pass",
        role="GLOBAL_OWNER",
    )


@pytest.fixture
def admin_user(db, tenant):
    return User.objects.create_user(
        username="admin",
        email="admin@test.com",
        password="pass",
        role="TENANT_ADMIN",
        tenant=tenant,
    )


@pytest.fixture
def athlete_user(db, tenant):
    return User.objects.create_user(
        username="athlete",
        email="athlete@test.com",
        password="pass",
        role="ATHLETE",
        tenant=tenant,
    )


@pytest.fixture
def create_activities(db, tenant, tenant2, athlete_user):
    """Creates 10 activities with mixed verification for dashboard testing."""
    user = athlete_user
    user2 = User.objects.create_user(
        username="athlete2",
        email="a2@test.com",
        password="pass",
        role="ATHLETE",
        tenant=tenant2,
    )
    acts = []
    for i in range(7):
        acts.append(
            Activity.objects.create(
                user=user,
                tenant=tenant,
                type="RUN",
                start_time=timezone.now(),
                distance=5000 + i * 200,
                is_verified=i < 5,
                verification_score=0.5 + i * 0.07,
            )
        )
    for i in range(3):
        acts.append(
            Activity.objects.create(
                user=user2,
                tenant=tenant2,
                type="BIKE",
                start_time=timezone.now(),
                distance=10000 + i * 500,
                is_verified=True,
                verification_score=0.9,
            )
        )
    return acts


@pytest.fixture
def unverified_activity(db, tenant, athlete_user):
    return Activity.objects.create(
        user=athlete_user,
        tenant=tenant,
        type="RUN",
        start_time=timezone.now(),
        distance=5000,
        is_verified=False,
        verification_score=0.25,
    )


# ---------------------------------------------------------------------------
# AdminDashboardStatsView
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAdminDashboardStats:
    def test_owner_gets_full_stats(
        self, api_client, owner_user, tenant, tenant2, create_activities
    ):
        api_client.force_authenticate(user=owner_user)
        response = api_client.get(reverse("admin-stats"))
        assert response.status_code == 200
        data = response.data
        assert data["total_users"] >= 3
        assert data["total_activities"] == 10
        assert data["total_distance_km"] > 0
        assert data["total_calories"] > 0
        assert data["verified_total"] == 8
        assert data["unverified_total"] == 2
        assert 70 <= data["verified_pct"] <= 90  # 8/10 = 80%
        assert len(data["per_tenant"]) >= 2

    def test_global_owner_gets_recent_unverified_queue(
        self, api_client, owner_user, tenant, create_activities
    ):
        api_client.force_authenticate(user=owner_user)
        response = api_client.get(reverse("admin-stats"))
        assert response.status_code == 200
        queue = response.data.get("recent_unverified") or []
        assert len(queue) == 2
        assert len({row["user"] for row in queue}) == 1
        assert queue[0]["user"] == "athlete"

    def test_per_tenant_breakdown(self, api_client, owner_user, tenant, create_activities):
        api_client.force_authenticate(user=owner_user)
        response = api_client.get(reverse("admin-stats"))
        assert response.status_code == 200
        tenants = {t["tenant_name"]: t for t in response.data["per_tenant"]}
        assert "Test City" in tenants
        assert tenants["Test City"]["activities"] == 7
        assert tenants["Test City"]["verified_pct"] < 90  # 2 unverified out of 7
        assert tenants["Test City"]["users"] >= 2

    def test_admin_gets_stats(self, api_client, admin_user, create_activities):
        api_client.force_authenticate(user=admin_user)
        response = api_client.get(reverse("admin-stats"))
        assert response.status_code == 200

    def test_tenant_admin_stats_scoped_to_tenant(self, api_client, admin_user, create_activities):
        """TENANT_ADMIN must see tenant totals only, not platform-wide aggregates."""
        api_client.force_authenticate(user=admin_user)
        response = api_client.get(reverse("admin-stats"))
        assert response.status_code == 200
        data = response.data
        assert data["total_activities"] == 7
        assert data.get("scoped_tenant_id") == str(admin_user.tenant_id)
        assert len(data["per_tenant"]) == 1
        assert data["per_tenant"][0]["tenant_name"] == "Test City"
        assert "recent_unverified" in data

    def test_athlete_denied(self, api_client, athlete_user, create_activities):
        api_client.force_authenticate(user=athlete_user)
        response = api_client.get(reverse("admin-stats"))
        assert response.status_code == 403

    def test_empty_stats(self, api_client, owner_user):
        api_client.force_authenticate(user=owner_user)
        response = api_client.get(reverse("admin-stats"))
        assert response.status_code == 200
        assert response.data["total_activities"] == 0
        assert response.data["verified_pct"] == 0.0


# ---------------------------------------------------------------------------
# ActivityApproveView / ActivityRejectView
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestActivityModeration:
    def test_owner_can_approve(self, api_client, owner_user, unverified_activity):
        api_client.force_authenticate(user=owner_user)
        url = reverse("admin-approve", kwargs={"activity_id": unverified_activity.id})
        response = api_client.post(url)
        assert response.status_code == 200
        assert response.data["status"] == "approved"
        unverified_activity.refresh_from_db()
        assert unverified_activity.is_verified is True
        assert unverified_activity.verification_score == 1.0

    def test_owner_can_reject(self, api_client, owner_user, unverified_activity):
        api_client.force_authenticate(user=owner_user)
        url = reverse("admin-reject", kwargs={"activity_id": unverified_activity.id})
        response = api_client.post(url)
        assert response.status_code == 200
        assert response.data["status"] == "rejected"
        unverified_activity.refresh_from_db()
        assert unverified_activity.is_verified is False
        assert unverified_activity.verification_score == 0.0

    def test_approve_nonexistent(self, api_client, owner_user):
        api_client.force_authenticate(user=owner_user)
        url = reverse("admin-approve", kwargs={"activity_id": 99999})
        response = api_client.post(url)
        assert response.status_code == 404

    def test_athlete_cannot_approve(self, api_client, athlete_user, unverified_activity):
        api_client.force_authenticate(user=athlete_user)
        url = reverse("admin-approve", kwargs={"activity_id": unverified_activity.id})
        response = api_client.post(url)
        assert response.status_code == 403

    def test_global_owner_filters_activities_by_tenant(
        self, api_client, owner_user, tenant, tenant2, create_activities
    ):
        api_client.force_authenticate(user=owner_user)
        response = api_client.get(
            reverse("global-activities"), {"tenant_id": str(tenant.id)}
        )
        assert response.status_code == 200
        results = response.data.get("results", response.data)
        assert len(results) == 7

    def test_tenant_admin_lists_scoped_activities(
        self, api_client, admin_user, tenant, tenant2, create_activities
    ):
        api_client.force_authenticate(user=admin_user)
        response = api_client.get(reverse("global-activities"))
        assert response.status_code == 200
        results = response.data.get("results", response.data)
        assert len(results) == 7
        assert response.data.get("count", len(results)) == 7

    def test_moderator_can_approve_in_tenant(self, api_client, tenant, unverified_activity):
        moderator = User.objects.create_user(
            username="mod",
            email="mod@test.com",
            password="pass",
            role="TENANT_MODERATOR",
            tenant=tenant,
        )
        api_client.force_authenticate(user=moderator)
        url = reverse("admin-approve", kwargs={"activity_id": unverified_activity.id})
        response = api_client.post(url)
        assert response.status_code == 200
