import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from users.models import Tenant

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def tenant(db):
    return Tenant.objects.create(name="T86 Tenant", is_active=True)


@pytest.fixture
def owner_user(db):
    return User.objects.create_user(
        username="t86-owner",
        email="t86-owner@example.com",
        password="password123",
        role="GLOBAL_OWNER",
    )


@pytest.fixture
def tenant_user(db, tenant):
    return User.objects.create_user(
        username="t86-athlete",
        email="t86-athlete@example.com",
        password="password123",
        role="ATHLETE",
        tenant=tenant,
    )


@pytest.mark.django_db
class TestGlobalOwnerSelfProtection:
    def test_single_self_deactivation_is_rejected(self, api_client, owner_user):
        api_client.force_authenticate(user=owner_user)

        response = api_client.patch(
            reverse("user-update", kwargs={"pk": owner_user.id}),
            {"is_active": False},
            format="json",
        )

        assert response.status_code == 403
        owner_user.refresh_from_db()
        assert owner_user.is_active is True
        assert owner_user.role == "GLOBAL_OWNER"

    def test_single_self_demotion_is_rejected(self, api_client, owner_user):
        api_client.force_authenticate(user=owner_user)

        response = api_client.patch(
            reverse("user-update", kwargs={"pk": owner_user.id}),
            {"role": "TENANT_ADMIN"},
            format="json",
        )

        assert response.status_code == 403
        owner_user.refresh_from_db()
        assert owner_user.role == "GLOBAL_OWNER"
        assert owner_user.is_active is True

    def test_bulk_self_deactivation_is_rejected_before_queueing(
        self,
        api_client,
        owner_user,
    ):
        api_client.force_authenticate(user=owner_user)

        response = api_client.post(
            reverse("users-bulk-set-status"),
            {"user_ids": [owner_user.id], "is_active": False},
            format="json",
        )

        assert response.status_code == 403
        owner_user.refresh_from_db()
        assert owner_user.is_active is True

    def test_bulk_self_demotion_is_rejected_before_queueing(
        self,
        api_client,
        owner_user,
    ):
        api_client.force_authenticate(user=owner_user)

        response = api_client.post(
            reverse("users-bulk-change-role"),
            {"user_ids": [owner_user.id], "role": "TENANT_ADMIN"},
            format="json",
        )

        assert response.status_code == 403
        owner_user.refresh_from_db()
        assert owner_user.role == "GLOBAL_OWNER"


@pytest.mark.django_db
class TestGlobalOwnerTenantNeutrality:
    def test_create_global_owner_ignores_tenant_assignment(
        self,
        api_client,
        owner_user,
        tenant,
    ):
        api_client.force_authenticate(user=owner_user)

        response = api_client.post(
            reverse("user-create"),
            {
                "username": "created-owner",
                "email": "created-owner@example.com",
                "password": "password123",
                "role": "GLOBAL_OWNER",
                "tenant_id": str(tenant.id),
            },
            format="json",
        )

        assert response.status_code == 201
        created = User.objects.get(username="created-owner")
        assert created.role == "GLOBAL_OWNER"
        assert created.tenant_id is None

    def test_update_to_global_owner_clears_tenant(
        self,
        api_client,
        owner_user,
        tenant_user,
        tenant,
    ):
        api_client.force_authenticate(user=owner_user)

        response = api_client.patch(
            reverse("user-update", kwargs={"pk": tenant_user.id}),
            {"role": "GLOBAL_OWNER", "tenant_id": str(tenant.id)},
            format="json",
        )

        assert response.status_code == 200
        tenant_user.refresh_from_db()
        assert tenant_user.role == "GLOBAL_OWNER"
        assert tenant_user.tenant_id is None

    def test_invite_global_owner_ignores_tenant_assignment(
        self,
        api_client,
        owner_user,
        tenant,
        monkeypatch,
    ):
        monkeypatch.setattr(
            "users.views.EmailService.send_invitation",
            lambda *args, **kwargs: None,
        )
        api_client.force_authenticate(user=owner_user)

        response = api_client.post(
            reverse("invitation"),
            {
                "email": "invited-owner@example.com",
                "name": "Invited Owner",
                "role": "GLOBAL_OWNER",
                "tenant_id": str(tenant.id),
            },
            format="json",
        )

        assert response.status_code == 201
        invited = User.objects.get(email="invited-owner@example.com")
        assert invited.role == "GLOBAL_OWNER"
        assert invited.tenant_id is None
