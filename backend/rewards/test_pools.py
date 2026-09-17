"""Tests for sponsor voucher pool creation and T74 reward idempotency."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from rewards.models import PointsLedger, Sponsor, Voucher, VoucherPool
from users.models import Tenant

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def tenant(db):
    return Tenant.objects.create(id="city-a", name="City A", is_active=True)


@pytest.fixture
def sponsor_user(db, tenant):
    return User.objects.create_user(
        username="sponsor",
        email="sponsor@test.com",
        password="pass",
        role="SPONSOR",
        tenant=tenant,
    )


@pytest.fixture
def athlete_user(db, tenant):
    return User.objects.create_user(
        username="athlete",
        email="athlete@test.com",
        password="pass",
        role="ATHLETE",
        tenant=tenant,
    )


@pytest.fixture
def redemption_pool(db):
    sponsor = Sponsor.objects.create(name="T74 Sponsor")
    now = timezone.now()
    pool = VoucherPool.objects.create(
        sponsor=sponsor,
        title="T74 Coffee",
        points_required=50,
        valid_from=now - timedelta(hours=1),
        valid_until=now + timedelta(days=1),
    )
    Voucher.objects.create(pool=pool, code="T74-POOL-A")
    Voucher.objects.create(pool=pool, code="T74-POOL-B")
    return pool


@pytest.mark.django_db
class TestVoucherPoolCreate:
    def test_sponsor_can_create_pool(self, api_client, sponsor_user):
        api_client.force_authenticate(user=sponsor_user)
        response = api_client.post(
            reverse("rewards:pool-list"),
            {
                "title": "Free Coffee",
                "description": "After your run",
                "points_required": 50,
                "quantity": 5,
                "valid_days": 30,
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.data["title"] == "Free Coffee"
        assert Sponsor.objects.filter(user=sponsor_user).exists()
        pool_id = response.data["id"]
        assert Voucher.objects.filter(pool_id=pool_id).count() == 5

    def test_athlete_cannot_create_pool(self, api_client, athlete_user):
        api_client.force_authenticate(user=athlete_user)
        response = api_client.post(
            reverse("rewards:pool-list"),
            {"title": "Nope", "points_required": 10},
            format="json",
        )
        assert response.status_code == 403


@pytest.mark.django_db
class TestVoucherRedemptionIdempotency:
    def test_redeem_requires_idempotency_key(self, api_client, athlete_user, redemption_pool):
        PointsLedger.objects.create(
            user=athlete_user,
            delta=100,
            reason="ADMIN_ADJUST",
            reference_id="seed-no-key",
        )
        api_client.force_authenticate(user=athlete_user)

        response = api_client.post(
            reverse("rewards:redeem", kwargs={"pool_id": redemption_pool.pk})
        )

        assert response.status_code == 400
        assert "Idempotency-Key" in response.data["detail"]
        assert Voucher.objects.filter(user=athlete_user).count() == 0

    def test_same_key_replays_one_redemption(self, api_client, athlete_user, redemption_pool):
        PointsLedger.objects.create(
            user=athlete_user,
            delta=100,
            reason="ADMIN_ADJUST",
            reference_id="seed-replay",
        )
        api_client.force_authenticate(user=athlete_user)
        url = reverse("rewards:redeem", kwargs={"pool_id": redemption_pool.pk})

        first = api_client.post(url, HTTP_IDEMPOTENCY_KEY="redeem-123")
        retry = api_client.post(url, HTTP_IDEMPOTENCY_KEY="redeem-123")

        assert first.status_code == 201
        assert retry.status_code == 201
        assert retry.data["id"] == first.data["id"]
        assert Voucher.objects.filter(user=athlete_user).count() == 1
        assert (
            PointsLedger.objects.filter(
                user=athlete_user,
                reason="VOUCHER_REDEEM",
            ).count()
            == 1
        )
