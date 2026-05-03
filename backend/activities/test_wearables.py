"""
P1 Tests — StravaService & GarminService
===========================================
RC v0.2: OAuth token exchange, activity sync, status, token refresh.
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from activities.models import WearableIntegration, Activity
from activities.wearables import StravaService, GarminService
from users.models import Tenant

User = get_user_model()


@pytest.fixture
def user(db):
    tenant = Tenant.objects.create(id="test-wear", name="Wearable City", is_active=True)
    return User.objects.create_user(
        username="wearer", email="wear@test.com", password="pass",
        role="ATHLETE", tenant=tenant,
    )


@pytest.fixture
def strava_integration(db, user):
    return WearableIntegration.objects.create(
        user=user, service="STRAVA",
        access_token="access_123", refresh_token="refresh_456",
        expires_at=timezone.now() + timedelta(hours=6),
        external_id="strava_athlete_42",
        is_active=True,
    )


@pytest.fixture
def garmin_integration(db, user):
    return WearableIntegration.objects.create(
        user=user, service="GARMIN",
        access_token="garmin_access_789",
        refresh_token="garmin_refresh_012",
        expires_at=timezone.now() + timedelta(hours=6),
        is_active=True,
    )


# ---------------------------------------------------------------------------
# StravaService
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestStravaService:
    def test_get_auth_url(self):
        with patch("activities.wearables.STRAVA_CLIENT_ID", "client_123"):
            url = StravaService.get_auth_url(user_id=42)
            assert "strava.com/oauth/authorize" in url
            assert "client_id=client_123" in url
            assert "state=42" in url
            assert "scope=read" in url

    def test_exchange_code_creates_integration(self, user):
        with patch("requests.post") as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = {
                "access_token": "new_access",
                "refresh_token": "new_refresh",
                "expires_in": 21600,
                "athlete": {"id": 12345},
            }
            integration = StravaService.exchange_code(user, "auth_code_xyz")
            assert integration is not None
            assert integration.access_token == "new_access"
            assert integration.external_id == "12345"
            assert integration.is_active is True

    def test_exchange_code_failure(self, user):
        with patch("requests.post") as mock_post:
            mock_post.return_value.status_code = 400
            mock_post.return_value.text = "Bad request"
            result = StravaService.exchange_code(user, "bad_code")
            assert result is None

    def test_get_status_connected(self, user, strava_integration):
        status = StravaService.get_status(user)
        assert status["connected"] is True
        assert status["external_id"] == "strava_athlete_42"

    def test_get_status_not_connected(self, user):
        status = StravaService.get_status(user)
        assert status["connected"] is False

    def test_refresh_token_when_not_expired(self, strava_integration):
        token = StravaService.refresh_token(strava_integration)
        assert token == "access_123"

    def test_refresh_token_when_expired(self, strava_integration):
        strava_integration.expires_at = timezone.now() - timedelta(hours=1)
        strava_integration.save()
        with patch("requests.post") as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = {
                "access_token": "refreshed_access",
                "refresh_token": "refreshed_refresh",
                "expires_in": 21600,
            }
            token = StravaService.refresh_token(strava_integration)
            assert token == "refreshed_access"
            strava_integration.refresh_from_db()
            assert strava_integration.access_token == "refreshed_access"

    def test_refresh_token_failure_deactivates(self, strava_integration):
        strava_integration.expires_at = timezone.now() - timedelta(hours=1)
        strava_integration.save()
        with patch("requests.post") as mock_post:
            mock_post.return_value.status_code = 400
            token = StravaService.refresh_token(strava_integration)
            assert token is None
            strava_integration.refresh_from_db()
            assert strava_integration.is_active is False

    def test_sync_activities_imports_runs(self, user, strava_integration):
        with patch.object(StravaService, "refresh_token", return_value="valid_token"):
            with patch("requests.get") as mock_get:
                mock_get.return_value.status_code = 200
                mock_get.return_value.json.return_value = [
                    {
                        "type": "Run",
                        "start_date": "2026-05-01T10:00:00Z",
                        "distance": 8500,
                        "moving_time": 2400,
                        "elapsed_time": 2500,
                    },
                    {
                        "type": "Ride",
                        "start_date": "2026-05-01T14:00:00Z",
                        "distance": 32000,
                        "moving_time": 3600,
                        "elapsed_time": 3800,
                    },
                ]
                count = StravaService.sync_activities(strava_integration)
                assert count == 2
                assert Activity.objects.filter(user=user, type="RUN").exists()
                assert Activity.objects.filter(user=user, type="BIKE").exists()

    def test_sync_activities_skips_duplicates(self, user, strava_integration):
        existing = Activity.objects.create(
            user=user, tenant=user.tenant, type="RUN",
            start_time="2026-05-01T10:00:00+00:00", distance=8500,
            is_verified=True, verification_score=1.0,
        )
        with patch.object(StravaService, "refresh_token", return_value="valid_token"):
            with patch("requests.get") as mock_get:
                mock_get.return_value.status_code = 200
                mock_get.return_value.json.return_value = [
                    {
                        "type": "Run",
                        "start_date": "2026-05-01T10:00:00Z",
                        "distance": 8500,
                        "moving_time": 2400,
                        "elapsed_time": 2500,
                    },
                ]
                count = StravaService.sync_activities(strava_integration)
                assert count == 0  # duplicate skipped


# ---------------------------------------------------------------------------
# GarminService
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestGarminService:
    def test_get_auth_url(self):
        with patch("activities.wearables.GARMIN_CLIENT_ID", "garmin_client_456"):
            url = GarminService.get_auth_url(user_id=7)
            assert "connect.garmin.com" in url
            assert "client_id=garmin_client_456" in url
            assert "state=7" in url

    def test_exchange_code_mock_fallback(self, user):
        with patch("activities.wearables.GARMIN_CLIENT_ID", "mock"):
            with patch("activities.wearables.GARMIN_CLIENT_SECRET", "mock"):
                integration = GarminService.exchange_code(user, "code")
                assert integration is not None
                assert integration.access_token == "mock_garmin_token"
                assert integration.is_active is True

    def test_get_status_connected(self, user, garmin_integration):
        status = GarminService.get_status(user)
        assert status["connected"] is True

    def test_get_status_not_connected(self, user):
        status = GarminService.get_status(user)
        assert status["connected"] is False

    def test_sync_activities_no_api_key_returns_zero(self, garmin_integration):
        with patch("activities.wearables.GARMIN_CLIENT_ID", "mock"):
            count = GarminService.sync_activities(garmin_integration)
            assert count == 0  # mock mode, no actual API call

    def test_sync_activities_maps_types_correctly(self, user, garmin_integration):
        with patch.object(GarminService, "refresh_token", return_value="valid"):
            with patch("requests.get") as mock_get:
                mock_get.return_value.status_code = 200
                mock_get.return_value.json.return_value = [
                    {
                        "activityType": {"typeKey": "running"},
                        "startTimeInSeconds": 1714000000000,
                        "distance": 500000,  # cm? will be *100 = 5000m
                        "duration": 1800,
                    },
                    {
                        "activityType": {"typeKey": "road_biking"},
                        "startTimeInSeconds": 1714002000000,
                        "distance": 1500000,
                        "duration": 2700,
                    },
                ]
                # We need GARMIN_CLIENT_ID to be set for the real API to be called
                with patch("activities.wearables.GARMIN_CLIENT_ID", "real_client"):
                    with patch("activities.wearables.GARMIN_CLIENT_SECRET", "real_secret"):
                        count = GarminService.sync_activities(garmin_integration)
                        assert count == 2
                        assert Activity.objects.filter(user=user, type="RUN").exists()
                        assert Activity.objects.filter(user=user, type="BIKE").exists()

    def test_map_activity_type(self):
        assert GarminService._map_activity_type("running") == "RUN"
        assert GarminService._map_activity_type("road_biking") == "BIKE"
        assert GarminService._map_activity_type("walking") == "WALK"
        assert GarminService._map_activity_type("trail_running") == "RUN"
        assert GarminService._map_activity_type("unknown_sport") is None
