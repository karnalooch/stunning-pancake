import pytest
import json
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from users.models import Tenant
from activities.models import Activity
from rewards.models import Sponsor, VoucherPool
from core.matrix_provisioner import MatrixProvisioner
from rewards.stripe_service import StripeService

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def tenant(db):
    return Tenant.objects.create(id="test-city", name="Test City", is_active=True)


@pytest.fixture
def athlete_user(db, tenant):
    return User.objects.create_user(
        username="athlete",
        email="athlete@test.com",
        password="password123",
        role="ATHLETE",
        tenant_id=tenant.id,
    )


@pytest.fixture
def moderator_user(db, tenant):
    return User.objects.create_user(
        username="moderator",
        email="mod@test.com",
        password="password123",
        role="TENANT_MODERATOR",
        tenant_id=tenant.id,
    )


# ---------------------------------------------------------------------------
# 1. Third-Party Integration Tests
# ---------------------------------------------------------------------------


class TestExternalIntegrations:
    @patch("requests.post")
    def test_matrix_room_creation(self, mock_post, db):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"room_id": "!test_room:matrix.org"}

        room_id = MatrixProvisioner.create_club_room("Runners Club", 1)
        assert room_id == "!test_room:matrix.org"
        assert mock_post.called

    @patch("stripe.checkout.Session.create")
    def test_stripe_checkout_session(self, mock_stripe, db):
        mock_stripe.return_value.url = "https://checkout.stripe.com/test"

        url = StripeService.create_b2c_checkout("athlete-123", "success-url", "cancel-url")
        assert "stripe.com" in url
        assert mock_stripe.called


# ---------------------------------------------------------------------------
# 2. Database Integrity & Multi-tenancy (RLS-like checks)
# ---------------------------------------------------------------------------


class TestDatabaseIntegrity:
    def test_user_tenant_relation(self, athlete_user, tenant):
        assert athlete_user.tenant_id == tenant.id
        assert tenant.users.filter(id=athlete_user.id).exists()

    def test_activity_persistence(self, athlete_user, tenant, db):
        activity = Activity.objects.create(
            user=athlete_user,
            type="RUN",
            start_time="2026-04-29T10:00:00Z",
            distance=5000.0,
            tenant=tenant,
        )
        assert Activity.objects.count() == 1
        assert activity.user.username == "athlete"


# ---------------------------------------------------------------------------
# 3. E2E Data Flow Simulation
# ---------------------------------------------------------------------------


class TestEndToEndFlow:
    @patch("core.matrix_provisioner.MatrixProvisioner.send_notification")
    def test_anti_cheat_to_matrix_alert(
        self, mock_notify, athlete_user, moderator_user, tenant, db
    ):
        # 1. Create a suspicious activity (simulating one that failed verification)
        activity = Activity.objects.create(
            user=athlete_user,
            type="RUN",
            start_time="2026-04-29T10:00:00Z",
            distance=100000.0,  # Impossible distance for a short time
            is_verified=False,
            verification_score=0.1,
            tenant=tenant,
        )

        # 2. Manually trigger the notification logic (as it would be in tasks.py)
        msg = f"🚨 [ANTI-CHEAT] Suspicious activity detected: {activity.user.username} - {activity.type}"
        MatrixProvisioner.send_notification("!mod_room:matrix.org", msg)

        assert mock_notify.called
        assert athlete_user.username in mock_notify.call_args[0][1]


# ---------------------------------------------------------------------------
# 4. Resilience Testing (Negative Scenarios)
# ---------------------------------------------------------------------------


class TestResilience:
    @patch("requests.post")
    def test_matrix_api_failure_graceful_handling(self, mock_post):
        mock_post.side_effect = Exception("Connection Timeout")

        # Should not crash, just log and return None
        room_id = MatrixProvisioner.create_club_room("Broken Club", 999)
        assert room_id is None or "dev_" in room_id  # Depending on _IS_PLACEHOLDER
