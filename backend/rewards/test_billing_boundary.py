"""T12 billing isolation and fail-closed Stripe boundary tests."""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from rewards.stripe_service import StripeService
from users.models import Tenant

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def tenant_a(db):
    return Tenant.objects.create(id=uuid.uuid4(), name="Tenant A", is_active=True)


@pytest.fixture
def tenant_b(db):
    return Tenant.objects.create(id=uuid.uuid4(), name="Tenant B", is_active=True)


@pytest.fixture
def tenant_admin(db, tenant_a):
    return User.objects.create_user(
        username="billing-admin",
        email="admin@example.com",
        password="pass",
        role="TENANT_ADMIN",
        tenant=tenant_a,
    )


@pytest.fixture
def athlete(db, tenant_a):
    return User.objects.create_user(
        username="billing-athlete",
        email="athlete@example.com",
        password="pass",
        role="ATHLETE",
        tenant=tenant_a,
    )


@pytest.fixture
def global_owner(db):
    return User.objects.create_user(
        username="billing-owner",
        email="owner@example.com",
        password="pass",
        role="GLOBAL_OWNER",
    )


def _clear_stripe_env(monkeypatch):
    for name in (
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_B2C_PRICE_ID",
        "STRIPE_B2B_PRICE_ID",
        "STRIPE_B2B_BILLING_ENABLED",
        "FRONTEND_URL",
    ):
        monkeypatch.delenv(name, raising=False)


def test_unconfigured_stripe_never_returns_mock_success(monkeypatch):
    _clear_stripe_env(monkeypatch)

    assert StripeService.create_b2c_checkout(1, "rider@example.com") is None
    assert StripeService.create_b2b_checkout("tenant", "owner@example.com", 10) is None
    assert StripeService.create_customer_portal("cus_test") is None
    assert (
        StripeService.create_connect_account(
            1,
            "rider@example.com",
            "https://example.com/refresh",
            "https://example.com/return",
        )
        is None
    )
    assert StripeService.create_transfer(1000, "acct_test") is None


def test_b2b_is_disabled_by_default_even_when_stripe_is_configured(monkeypatch):
    _clear_stripe_env(monkeypatch)
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_example")
    monkeypatch.setenv("STRIPE_B2B_PRICE_ID", "price_b2b")
    monkeypatch.setenv("FRONTEND_URL", "https://admin.example.com")

    assert StripeService.b2b_available() is False


@pytest.mark.django_db
def test_athlete_cannot_create_b2b_checkout(api_client, athlete):
    api_client.force_authenticate(user=athlete)

    with patch.object(StripeService, "b2b_available", return_value=True):
        response = api_client.post(
            reverse("rewards:stripe-b2b"),
            {"tenant_id": str(athlete.tenant_id), "seats": 5},
            format="json",
        )

    assert response.status_code == 403


@pytest.mark.django_db
def test_tenant_admin_cannot_spoof_another_tenant(
    api_client,
    tenant_admin,
    tenant_b,
):
    api_client.force_authenticate(user=tenant_admin)

    with (
        patch.object(StripeService, "b2b_available", return_value=True),
        patch.object(
            StripeService,
            "create_b2b_checkout",
            return_value="https://checkout.stripe.com/test",
        ) as create_checkout,
    ):
        response = api_client.post(
            reverse("rewards:stripe-b2b"),
            {"tenant_id": str(tenant_b.pk), "seats": 7},
            format="json",
        )

    assert response.status_code == 200
    create_checkout.assert_called_once_with(
        tenant_id=str(tenant_admin.tenant_id),
        email=tenant_admin.email,
        seats=7,
    )


@pytest.mark.django_db
def test_global_owner_b2b_target_must_be_an_existing_active_tenant(
    api_client,
    global_owner,
):
    api_client.force_authenticate(user=global_owner)

    with patch.object(StripeService, "b2b_available", return_value=True):
        response = api_client.post(
            reverse("rewards:stripe-b2b"),
            {"tenant_id": str(uuid.uuid4()), "seats": 2},
            format="json",
        )

    assert response.status_code == 403


@pytest.mark.django_db
def test_global_owner_can_target_valid_tenant(api_client, global_owner, tenant_b):
    api_client.force_authenticate(user=global_owner)

    with (
        patch.object(StripeService, "b2b_available", return_value=True),
        patch.object(
            StripeService,
            "create_b2b_checkout",
            return_value="https://checkout.stripe.com/test",
        ) as create_checkout,
    ):
        response = api_client.post(
            reverse("rewards:stripe-b2b"),
            {"tenant_id": str(tenant_b.pk), "seats": 12},
            format="json",
        )

    assert response.status_code == 200
    create_checkout.assert_called_once_with(
        tenant_id=str(tenant_b.pk),
        email=global_owner.email,
        seats=12,
    )


@pytest.mark.django_db
def test_disabled_b2b_returns_service_unavailable(api_client, tenant_admin):
    api_client.force_authenticate(user=tenant_admin)

    with patch.object(StripeService, "b2b_available", return_value=False):
        response = api_client.post(
            reverse("rewards:stripe-b2b"),
            {"seats": 2},
            format="json",
        )

    assert response.status_code == 503


@pytest.mark.django_db
def test_webhook_without_secret_is_service_unavailable(api_client, monkeypatch):
    _clear_stripe_env(monkeypatch)

    response = api_client.post(
        reverse("rewards:stripe-webhook"),
        data=b'{"type":"test"}',
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE="sig_test",
    )

    assert response.status_code == 503
    assert response.data["status"] == "unavailable"
