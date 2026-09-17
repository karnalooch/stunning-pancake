from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from activities.models import Activity
from rewards.models import PointsLedger, Sponsor, Voucher, VoucherPool
from rewards.services import RewardsService
from users.models import Tenant

User = get_user_model()


@pytest.fixture
def tenant(db):
    return Tenant.objects.create(name="T74 Rewards City")


@pytest.fixture
def athlete(db, tenant):
    return User.objects.create_user(
        username="t74-rewards-athlete",
        email="t74-rewards@example.test",
        password="pass",
        tenant=tenant,
    )


@pytest.fixture
def reward_pool(db):
    sponsor = Sponsor.objects.create(name="T74 Sponsor")
    now = timezone.now()
    pool = VoucherPool.objects.create(
        sponsor=sponsor,
        title="Coffee",
        points_required=50,
        valid_from=now - timedelta(hours=1),
        valid_until=now + timedelta(days=1),
    )
    Voucher.objects.create(pool=pool, code="T74-A")
    Voucher.objects.create(pool=pool, code="T74-B")
    return pool


@pytest.mark.django_db
def test_redemption_requires_idempotency_key(athlete, reward_pool):
    PointsLedger.objects.create(
        user=athlete,
        delta=100,
        reason="ADMIN_ADJUST",
        reference_id="seed",
    )
    client = APIClient()
    client.force_authenticate(user=athlete)

    response = client.post(reverse("rewards:redeem", kwargs={"pool_id": reward_pool.pk}))

    assert response.status_code == 400
    assert "Idempotency-Key" in response.data["detail"]
    assert Voucher.objects.filter(user=athlete).count() == 0


@pytest.mark.django_db
def test_same_redemption_key_replays_one_business_effect(athlete, reward_pool):
    PointsLedger.objects.create(
        user=athlete,
        delta=100,
        reason="ADMIN_ADJUST",
        reference_id="seed",
    )
    client = APIClient()
    client.force_authenticate(user=athlete)
    url = reverse("rewards:redeem", kwargs={"pool_id": reward_pool.pk})

    first = client.post(url, HTTP_IDEMPOTENCY_KEY="redeem-123")
    retry = client.post(url, HTTP_IDEMPOTENCY_KEY="redeem-123")

    assert first.status_code == 201
    assert retry.status_code == 201
    assert retry.data["id"] == first.data["id"]
    assert Voucher.objects.filter(user=athlete).count() == 1
    assert PointsLedger.objects.filter(
        user=athlete,
        reason="VOUCHER_REDEEM",
    ).count() == 1
    assert RewardsService.get_balance(athlete.pk) == 50


@pytest.mark.django_db
def test_different_redemption_keys_are_distinct_user_intents(athlete, reward_pool):
    PointsLedger.objects.create(
        user=athlete,
        delta=150,
        reason="ADMIN_ADJUST",
        reference_id="seed",
    )
    client = APIClient()
    client.force_authenticate(user=athlete)
    url = reverse("rewards:redeem", kwargs={"pool_id": reward_pool.pk})

    first = client.post(url, HTTP_IDEMPOTENCY_KEY="redeem-a")
    second = client.post(url, HTTP_IDEMPOTENCY_KEY="redeem-b")

    assert first.status_code == 201
    assert second.status_code == 201
    assert second.data["id"] != first.data["id"]
    assert Voucher.objects.filter(user=athlete).count() == 2
    assert PointsLedger.objects.filter(
        user=athlete,
        reason="VOUCHER_REDEEM",
    ).count() == 2
    assert RewardsService.get_balance(athlete.pk) == 50


@pytest.mark.django_db
def test_activity_award_is_idempotent(athlete, tenant):
    activity = Activity.objects.create(
        user=athlete,
        tenant=tenant,
        type="BIKE",
        start_time=timezone.now(),
        distance=10_000,
    )

    first = RewardsService.award_for_activity(activity.pk)
    retry = RewardsService.award_for_activity(activity.pk)

    assert first == 100
    assert retry == 0
    assert PointsLedger.objects.filter(
        user=athlete,
        reason="ACTIVITY_VERIFIED",
        reference_id=f"activity:{activity.pk}",
    ).count() == 1
