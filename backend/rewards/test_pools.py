"""Tests for sponsor voucher pool creation."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from rewards.models import Sponsor, Voucher
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
