"""Moderation queue and cross-tenant guard tests."""

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from activities.models import Activity
from users.models import Tenant

User = get_user_model()


@pytest.fixture
def tenants(db):
    t1 = Tenant.objects.create(name="City A")
    t2 = Tenant.objects.create(name="City B")
    return t1, t2


@pytest.fixture
def moderator_a(db, tenants):
    t1, _ = tenants
    return User.objects.create_user(
        username="mod_a",
        password="pass12345",
        role="TENANT_MODERATOR",
        tenant=t1,
    )


@pytest.fixture
def moderator_b(db, tenants):
    _, t2 = tenants
    return User.objects.create_user(
        username="mod_b",
        password="pass12345",
        role="TENANT_MODERATOR",
        tenant=t2,
    )


@pytest.fixture
def activity_tenant_a(db, tenants, moderator_a):
    t1, _ = tenants
    athlete = User.objects.create_user(
        username="ath_a",
        password="pass12345",
        role="ATHLETE",
        tenant=t1,
    )
    return Activity.objects.create(
        user=athlete,
        tenant=t1,
        type="BIKE",
        start_time=timezone.now(),
        is_verified=False,
    )


@pytest.mark.django_db
def test_moderation_queue_scoped_to_tenant(moderator_a, activity_tenant_a):
    client = APIClient()
    client.force_authenticate(user=moderator_a)
    res = client.get("/api/activities/admin/moderation/queue/")
    assert res.status_code == 200
    assert res.data["count"] >= 1
    assert all(str(r.get("tenant_id")) == str(moderator_a.tenant_id) for r in res.data["results"])


@pytest.mark.django_db
def test_cross_tenant_reject_forbidden(moderator_b, activity_tenant_a):
    client = APIClient()
    client.force_authenticate(user=moderator_b)
    res = client.post(
        f"/api/activities/admin/reject/{activity_tenant_a.id}/",
        {"reason": "GPS_SPOOF"},
        format="json",
    )
    assert res.status_code == 403
