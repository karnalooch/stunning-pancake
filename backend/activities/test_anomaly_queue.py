"""Anti-cheat anomaly queue (Paczka 5)."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from activities.models import Activity
from activities.services import AntiCheatEngine
from users.models import Tenant

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def tenant(db):
    return Tenant.objects.create(id="city-a", name="City A", is_active=True)


@pytest.fixture
def moderator(db, tenant):
    return User.objects.create_user(
        username="mod",
        email="mod@test.com",
        password="pass",
        role="TENANT_MODERATOR",
        tenant=tenant,
    )


@pytest.fixture
def activities(db, tenant, moderator):
    user = User.objects.create_user(
        username="athlete",
        email="a@test.com",
        password="pass",
        role="ATHLETE",
        tenant=tenant,
    )
    low = Activity.objects.create(
        user=user,
        tenant=tenant,
        type="RUN",
        start_time=timezone.now(),
        distance=5000,
        is_verified=False,
        verification_score=0.12,
    )
    borderline = Activity.objects.create(
        user=user,
        tenant=tenant,
        type="BIKE",
        start_time=timezone.now(),
        distance=8000,
        is_verified=False,
        verification_score=0.28,
    )
    pending = Activity.objects.create(
        user=user,
        tenant=tenant,
        type="RUN",
        start_time=timezone.now(),
        distance=3000,
        is_verified=False,
        verification_score=0.55,
    )
    return {"low": low, "borderline": borderline, "pending": pending}


class TestAnomalySeverity:
    def test_critical_threshold(self):
        assert AntiCheatEngine.anomaly_severity(0.1) == "critical"

    def test_high_threshold(self):
        assert AntiCheatEngine.anomaly_severity(0.2) == "high"

    def test_medium_threshold(self):
        assert AntiCheatEngine.anomaly_severity(0.29) == "medium"


class TestGetRecentAnomalies:
    def test_excludes_high_score_pending(self, tenant, activities):
        rows = AntiCheatEngine.get_recent_anomalies(tenant_id=str(tenant.id))
        ids = {r["activity_id"] for r in rows}
        assert activities["low"].id in ids
        assert activities["borderline"].id in ids
        assert activities["pending"].id not in ids

    def test_includes_severity_and_description(self, tenant, activities):
        rows = AntiCheatEngine.get_recent_anomalies(tenant_id=str(tenant.id))
        low = next(r for r in rows if r["activity_id"] == activities["low"].id)
        assert low["severity"] == "critical"
        assert "Critical" in low["description"]


class TestAnomalyListApi:
    def test_moderator_gets_scoped_anomalies(self, activities, moderator):
        client = APIClient()
        client.force_authenticate(user=moderator)
        response = client.get(reverse("telemetry-anomalies"))
        assert response.status_code == 200
        assert len(response.data) == 2


class TestWeeklyActivityBreakdown:
    def test_returns_seven_days(self, tenant, activities):
        from activities.admin_stats import _weekly_activity_breakdown

        chart = _weekly_activity_breakdown(str(tenant.id))
        assert len(chart) == 7
        assert chart[0]["name"] in ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
