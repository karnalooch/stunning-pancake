"""Issue short-lived telemetry JWT scoped to one activity.

Activity-scoped ``POST /api/activities/sessions/<pk>/telemetry-token/``
returns a JWT with ``aud='telemetry'`` so the mobile client can call
``/api/telemetry/ingest`` even when ``TELEMETRY_INGEST_AUDIENCE_REQUIRED``
is enforced by ``IngestJwtMiddleware``. Ownership is enforced by the
``ActivityViewSet.get_queryset`` filter — another user's activity
returns 404.

Run:
    cd backend && python run_pytest.py activities/test_telemetry_token_view.py -v
"""

from datetime import UTC, datetime, timedelta

import jwt as pyjwt
import pytest
from rest_framework.test import APIClient

from activities.models import Activity
from users.models import Tenant

pytestmark = pytest.mark.simulator_light


TELEMETRY_TOKEN_URL = "/api/activities/sessions/{activity_id}/telemetry-token/"


@pytest.fixture(autouse=True)
def _jwt_secret(monkeypatch):
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", "telemetry-token-test-key" * 2)


@pytest.fixture
def user(django_user_model):
    tenant = Tenant.objects.create(name="Telemetry token test tenant")
    return django_user_model.objects.create_user(
        username="rider",
        email="rider@test.local",
        password="x",
        tenant=tenant,
    )


@pytest.fixture
def other_user(django_user_model):
    return django_user_model.objects.create_user(
        username="other",
        email="other@test.local",
        password="x",
    )


@pytest.fixture
def activity(user):
    return Activity.objects.create(user=user)


@pytest.fixture
def client_with_user(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_token_endpoint_requires_authentication(activity):
    client = APIClient()
    response = client.post(TELEMETRY_TOKEN_URL.format(activity_id=activity.id))
    assert response.status_code == 401


def test_token_endpoint_returns_telemetry_audience_jwt(client_with_user, activity):
    response = client_with_user.post(TELEMETRY_TOKEN_URL.format(activity_id=activity.id))
    assert response.status_code == 200
    body = response.json()
    assert body["audience"] == "telemetry"
    assert body["activity_id"] == activity.id
    assert "token" in body
    assert "expires_at" in body

    secret = "telemetry-token-test-key" * 2
    claims = pyjwt.decode(
        body["token"],
        secret,
        algorithms=["HS256"],
        audience="telemetry",
    )
    assert claims["aud"] == "telemetry"
    assert claims["activity_id"] == activity.id
    assert claims["sub"] == str(client_with_user.handler._force_user.id)
    assert claims["tenant_id"] == str(activity.user.tenant_id)


def test_token_endpoint_rejects_other_users_activity(client_with_user, other_user):
    other_activity = Activity.objects.create(user=other_user)
    response = client_with_user.post(TELEMETRY_TOKEN_URL.format(activity_id=other_activity.id))
    assert response.status_code == 404


def test_token_endpoint_404_for_unknown_activity(client_with_user):
    response = client_with_user.post(TELEMETRY_TOKEN_URL.format(activity_id=999_999))
    assert response.status_code == 404


def test_token_expiry_is_five_minutes(client_with_user, activity):
    response = client_with_user.post(TELEMETRY_TOKEN_URL.format(activity_id=activity.id))
    body = response.json()
    expires_at = datetime.fromisoformat(body["expires_at"].replace("Z", "+00:00"))
    delta = expires_at - datetime.now(UTC)
    assert timedelta(minutes=4, seconds=30) < delta < timedelta(minutes=5, seconds=30)


def test_token_works_against_telemetry_ingest_auth(client_with_user, activity, monkeypatch):
    """End-to-end: the issued token is accepted by IngestJwtMiddleware."""
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    response = client_with_user.post(TELEMETRY_TOKEN_URL.format(activity_id=activity.id))
    token = response.json()["token"]

    # Replay the token against the same secret + audience.
    secret = "telemetry-token-test-key" * 2
    claims = pyjwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        audience="telemetry",
    )
    assert claims["aud"] == "telemetry"
    assert claims["activity_id"] == activity.id
    assert claims["tenant_id"] == str(activity.user.tenant_id)
