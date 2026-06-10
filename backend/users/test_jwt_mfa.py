"""JWT login MFA gate (P2 Auth)."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from users.mfa import generate_totp_secret, _totp_at
from users.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


def test_global_owner_with_mfa_requires_code(api_client):
    secret = generate_totp_secret()
    User.objects.create_user(
        username="go_mfa",
        email="go@test.com",
        password="pass123",
        role="GLOBAL_OWNER",
        mfa_enabled=True,
        mfa_secret=secret,
    )
    url = reverse("token_obtain_pair")
    res = api_client.post(url, {"username": "go_mfa", "password": "pass123"}, format="json")
    assert res.status_code == 400
    assert res.data.get("mfa_required") is True

    import time

    code = _totp_at(secret, int(time.time()) // 30)
    res2 = api_client.post(
        url,
        {"username": "go_mfa", "password": "pass123", "mfa_code": code},
        format="json",
    )
    assert res2.status_code == 200
    assert "access" in res2.data


def test_tenant_admin_mfa_not_enforced_at_login(api_client):
    User.objects.create_user(
        username="ta",
        email="ta@test.com",
        password="pass123",
        role="TENANT_ADMIN",
        mfa_enabled=True,
        mfa_secret=generate_totp_secret(),
    )
    url = reverse("token_obtain_pair")
    res = api_client.post(url, {"username": "ta", "password": "pass123"}, format="json")
    assert res.status_code == 200
