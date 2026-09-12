"""JWT login contract for mandatory administrator MFA."""

import time
from urllib.parse import parse_qs, urlparse

import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from core.social_auth import build_auth_redirect
from users.jwt_views import restricted_token_pair_for_user
from users.mfa import _totp_at, generate_totp_secret
from users.models import User

pytestmark = pytest.mark.django_db
ADMIN_ROLES = ("GLOBAL_OWNER", "TENANT_ADMIN", "TENANT_MODERATOR")


@pytest.fixture
def api_client():
    return APIClient()


def _create_user(role, *, mfa_enabled=False):
    secret = generate_totp_secret() if mfa_enabled else ""
    user = User.objects.create_user(
        username=f"user_{role.lower()}",
        email=f"{role.lower()}@test.com",
        password="pass12345",
        role=role,
        mfa_enabled=mfa_enabled,
        mfa_secret=secret,
    )
    return user, secret


@pytest.mark.parametrize("role", ADMIN_ROLES)
def test_admin_without_mfa_gets_enrollment_only_session(api_client, role):
    user, _ = _create_user(role)
    login = api_client.post(
        reverse("token_obtain_pair"),
        {"username": user.username, "password": "pass12345"},
        format="json",
    )
    assert login.status_code == 200
    assert login.data["mfa_setup_required"] is True

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    assert api_client.get(reverse("mfa-status")).status_code == 200
    assert api_client.get(reverse("profile")).status_code == 200
    assert api_client.get(reverse("user-preferences")).status_code == 401

    refreshed = api_client.post(reverse("token_refresh"), {"refresh": login.data["refresh"]})
    assert refreshed.status_code == 200
    assert AccessToken(refreshed.data["access"])["mfa_setup_required"] is True


@pytest.mark.parametrize("role", ADMIN_ROLES)
def test_enabled_admin_requires_valid_totp(api_client, role):
    user, secret = _create_user(role, mfa_enabled=True)
    url = reverse("token_obtain_pair")
    credentials = {"username": user.username, "password": "pass12345"}
    assert api_client.post(url, credentials, format="json").status_code == 400
    assert (
        api_client.post(url, {**credentials, "mfa_code": "000000"}, format="json").status_code
        == 400
    )
    code = _totp_at(secret, int(time.time()) // 30)
    valid = api_client.post(url, {**credentials, "mfa_code": code}, format="json")
    assert valid.status_code == 200
    assert "access" in valid.data
    assert AccessToken(valid.data["access"])["mfa_verified"] is True


def test_non_admin_login_remains_unchanged(api_client):
    user, _ = _create_user("ATHLETE")
    response = api_client.post(
        reverse("token_obtain_pair"),
        {"username": user.username, "password": "pass12345"},
        format="json",
    )
    assert response.status_code == 200
    assert "access" in response.data
    assert "mfa_setup_required" not in response.data


def test_role_escalation_restricts_preexisting_non_admin_token(api_client):
    user, _ = _create_user("ATHLETE")
    login = api_client.post(
        reverse("token_obtain_pair"),
        {"username": user.username, "password": "pass12345"},
        format="json",
    )
    user.role = "TENANT_ADMIN"
    user.save(update_fields=["role"])

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    assert api_client.get(reverse("mfa-status")).status_code == 200
    assert api_client.get(reverse("user-preferences")).status_code == 401


@pytest.mark.parametrize("role", ADMIN_ROLES)
def test_mfa_status_marks_every_admin_role_as_required(api_client, role):
    user, _ = _create_user(role)
    api_client.force_authenticate(user)
    response = api_client.get(reverse("mfa-status"))
    assert response.status_code == 200
    assert response.data["required_for_role"] is True


def test_restricted_emitter_marks_social_admin_sessions(api_client):
    user, secret = _create_user("TENANT_ADMIN", mfa_enabled=True)
    tokens = restricted_token_pair_for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    assert api_client.get(reverse("user-preferences")).status_code == 401

    code = _totp_at(secret, int(time.time()) // 30)
    verified = api_client.post(reverse("mfa-verify-session"), {"code": code}, format="json")
    assert verified.status_code == 200
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {verified.data['access']}")
    assert api_client.get(reverse("user-preferences")).status_code == 200


def test_social_redirect_contains_restricted_admin_token():
    user, _ = _create_user("TENANT_ADMIN")
    parsed = urlparse(build_auth_redirect(user))
    query = parse_qs(parsed.fragment.partition("?")[2] or parsed.query)
    token = AccessToken(query["access"][0])
    assert token["mfa_setup_required"] is True
    assert "mfa_verified" not in token


def test_impersonating_admin_issues_restricted_token(api_client):
    owner, _ = _create_user("GLOBAL_OWNER", mfa_enabled=True)
    target, _ = _create_user("TENANT_ADMIN")
    api_client.force_authenticate(owner)
    response = api_client.post(reverse("impersonate", kwargs={"target_user_id": target.id}))
    assert response.status_code == 200
    token = AccessToken(response.data["access"])
    assert token["impersonated"] is True
    assert token["mfa_setup_required"] is True


@pytest.mark.parametrize("role", ADMIN_ROLES)
def test_admin_cannot_disable_mandatory_mfa(api_client, role):
    user, secret = _create_user(role, mfa_enabled=True)
    api_client.force_authenticate(user)
    response = api_client.post(
        reverse("mfa-disable"),
        {"code": _totp_at(secret, int(time.time()) // 30)},
        format="json",
    )
    user.refresh_from_db()
    assert response.status_code == 403
    assert user.mfa_enabled is True


def test_enrollment_returns_unrestricted_replacement_tokens(api_client):
    user, _ = _create_user("GLOBAL_OWNER")
    login = api_client.post(
        reverse("token_obtain_pair"),
        {"username": user.username, "password": "pass12345"},
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    setup = api_client.post(reverse("mfa-setup"))
    user.refresh_from_db()
    code = _totp_at(user.mfa_secret_pending, int(time.time()) // 30)
    enabled = api_client.post(reverse("mfa-enable"), {"code": code})
    assert enabled.status_code == 200
    assert "mfa_setup_required" not in AccessToken(enabled.data["access"])
    assert AccessToken(enabled.data["access"])["mfa_verified"] is True
