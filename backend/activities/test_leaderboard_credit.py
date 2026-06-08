"""
Tests for idempotent leaderboard credit and process-queue dedupe.
"""

from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from activities.leaderboard_credit import credit_verified_activity
from activities.models import Activity
from users.models import Tenant

User = get_user_model()


@pytest.fixture
def user(db):
    tenant = Tenant.objects.create(id="test-credit", name="Credit City", is_active=True)
    return User.objects.create_user(
        username="crediter",
        email="crediter@test.com",
        password="pass",
        role="ATHLETE",
        tenant=tenant,
    )


@pytest.fixture
def verified_activity(db, user):
    now = timezone.now()
    return Activity.objects.create(
        user=user,
        tenant=user.tenant,
        type="RUN",
        start_time=now - timedelta(hours=1),
        end_time=now,
        distance=10000.0,
        is_verified=True,
        verification_score=1.0,
    )


@pytest.mark.django_db
class TestCreditVerifiedActivity:
    def test_double_credit_blocked(self, verified_activity):
        mock_redis = MagicMock()
        mock_redis.set.side_effect = [True, False]

        with (
            patch("core.redis_cluster.get_redis", return_value=mock_redis),
            patch("activities.leaderboards.LeaderboardService.update_score") as mock_lb,
            patch("events.services.EventProgressService.record_activity"),
        ):
            assert credit_verified_activity(verified_activity) is True
            assert credit_verified_activity(verified_activity) is False
            mock_lb.assert_called_once()

    def test_unverified_not_credited(self, user):
        act = Activity.objects.create(
            user=user,
            tenant=user.tenant,
            type="WALK",
            start_time=timezone.now(),
            distance=1000.0,
            is_verified=False,
        )
        with patch("core.redis_cluster.get_redis") as mock_get:
            assert credit_verified_activity(act) is False
            mock_get.assert_not_called()


@pytest.mark.django_db
class TestWearableExternalIdDedupe:
    def test_strava_duplicate_external_id_skipped(self, user):
        from activities.models import WearableIntegration
        from activities.wearables import StravaService

        integration = WearableIntegration.objects.create(
            user=user,
            service="STRAVA",
            access_token="tok",
            expires_at=timezone.now() + timedelta(hours=1),
            is_active=True,
        )
        Activity.objects.create(
            user=user,
            tenant=user.tenant,
            type="RUN",
            start_time="2026-05-01T10:00:00+00:00",
            distance=5000,
            external_source="STRAVA",
            external_id="999",
            is_verified=True,
        )

        with (
            patch.object(StravaService, "refresh_token", return_value="valid_token"),
            patch("activities.wearables._finalize_imported_activity"),
            patch("requests.get") as mock_get,
        ):
            mock_get.return_value.status_code = 200
            mock_get.return_value.json.return_value = [
                {
                    "id": 999,
                    "type": "Run",
                    "start_date": "2026-05-01T10:00:00Z",
                    "distance": 5000,
                    "moving_time": 1800,
                    "elapsed_time": 1900,
                },
            ]
            count = StravaService.sync_activities(integration)
            assert count == 0
