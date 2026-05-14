"""
P3 Tests — Celery Task Pipeline Integration
=============================================
Tests for process_activity_async: fast rejection gate,
already-verified skip, and not-found error handling.
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString
from users.models import Tenant
from activities.models import Activity
from activities.tasks import process_activity_async

User = get_user_model()


@pytest.fixture
def user(db):
    """Create a basic ATHLETE user with a tenant."""
    tenant = Tenant.objects.create(id="test-tasks", name="Tasks City", is_active=True)
    return User.objects.create_user(
        username="tasker", email="tasker@test.com", password="pass",
        role="ATHLETE", tenant=tenant,
    )


@pytest.fixture
def activity(db, user):
    """Create an unverified activity with a route and end_time."""
    now = timezone.now()
    return Activity.objects.create(
        user=user,
        tenant=user.tenant,
        type="RUN",
        start_time=now - timedelta(hours=1),
        end_time=now - timedelta(minutes=30),
        distance=5000.0,
        is_verified=False,
        route_path=LineString([(0, 0), (0.001, 0)], srid=4326),
    )


@pytest.mark.django_db
class TestProcessActivityTask:
    def test_rejected_by_fast_gate(self, activity):
        """Activity should be rejected if fast_rejection_gate fails."""
        activity.is_verified = False
        activity.save()

        # Mock redis to return empty config (auto_ban=True by default since config is empty)
        with patch('core.redis_cluster.get_redis') as mock_redis, \
             patch('activities.signal_processing.fast_rejection_gate') as mock_gate:
            mock_redis.return_value.get.return_value = None
            mock_gate.return_value = {
                "passed": False,
                "reason": "TELEPORT: 1000m jump",
                "details": {"teleport_dist_m": 1000},
            }

            result = process_activity_async(activity.id)
            assert result["status"] == "rejected_gate"
            assert "TELEPORT" in result["reason"]

    def test_skips_already_verified(self, activity):
        """Already verified activity should be skipped."""
        activity.is_verified = True
        activity.save()

        with patch('core.redis_cluster.get_redis') as mock_redis:
            mock_redis.return_value.get.return_value = None
            result = process_activity_async(activity.id)
            assert result["status"] == "skipped"

    def test_activity_not_found(self):
        """Non-existent activity should return error."""
        with patch('core.redis_cluster.get_redis') as mock_redis:
            mock_redis.return_value.get.return_value = None
            result = process_activity_async(999999)
            assert result["status"] == "error"
            assert result["reason"] == "not_found"

    def test_skips_missing_route_path(self, user):
        """Activity without route_path should be skipped."""
        now = timezone.now()
        act = Activity.objects.create(
            user=user,
            tenant=user.tenant,
            type="WALK",
            start_time=now - timedelta(hours=1),
            end_time=now - timedelta(minutes=30),
            distance=2000.0,
            is_verified=False,
            route_path=None,
        )
        with patch('core.redis_cluster.get_redis') as mock_redis:
            mock_redis.return_value.get.return_value = None
            result = process_activity_async(act.id)
            assert result["status"] == "skipped"
