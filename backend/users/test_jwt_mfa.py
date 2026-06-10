"""JWT login — MFA gate deferred for GLOBAL_OWNER (P2 Auth, end of roadmap)."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from users.mfa import generate_totp_secret
from users.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


def test_global_owner_logs_in_without_mfa_gate(api_client):
    """GO with mfa_enabled still logs in with password only until MFA is re-enabled."""
    User.objects.create_user(
        username="go_mfa",
        email="go@test.com",
        password="pass123",
        role="GLOBAL_OWNER",
        mfa_enabled=True,
        mfa_secret=generate_totp_secret(),
    )
    url = reverse("token_obtain_pair")
    res = api_client.post(url, {"username": "go_mfa", "password": "pass123"}, format="json")
    assert res.status_code == 200
    assert "access" in res.data
