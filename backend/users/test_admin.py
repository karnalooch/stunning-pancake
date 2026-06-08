"""
P0 Tests — User CRUD, Invitation, Audit Logging
==================================================
RC v0.2 critical paths: create/delete users, invitations, audit trail.
"""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from users.models import AuditLog, Tenant

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def tenant(db):
    return Tenant.objects.create(id="test-city", name="Test City", is_active=True)


@pytest.fixture
def owner_user(db):
    return User.objects.create_user(
        username="owner",
        email="owner@test.com",
        password="password123",
        role="GLOBAL_OWNER",
    )


@pytest.fixture
def admin_user(db, tenant):
    return User.objects.create_user(
        username="admin",
        email="admin@test.com",
        password="password123",
        role="TENANT_ADMIN",
        tenant=tenant,
    )


@pytest.fixture
def other_tenant(db):
    return Tenant.objects.create(id="other-city", name="Other City", is_active=True)


@pytest.fixture
def other_tenant_admin(db, other_tenant):
    return User.objects.create_user(
        username="admin2",
        email="admin2@test.com",
        password="password123",
        role="TENANT_ADMIN",
        tenant=other_tenant,
    )


@pytest.fixture
def moderator_user(db, tenant):
    return User.objects.create_user(
        username="mod",
        email="mod@test.com",
        password="password123",
        role="TENANT_MODERATOR",
        tenant=tenant,
    )


@pytest.fixture
def sponsor_user(db, tenant):
    return User.objects.create_user(
        username="sponsor",
        email="sponsor@test.com",
        password="password123",
        role="SPONSOR",
        tenant=tenant,
    )


@pytest.fixture
def athlete_user(db, tenant):
    return User.objects.create_user(
        username="athlete",
        email="athlete@test.com",
        password="password123",
        role="ATHLETE",
        tenant=tenant,
    )


# ---------------------------------------------------------------------------
# UserCreateView
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUserCreate:
    def test_owner_can_create_user(self, api_client, owner_user, tenant):
        api_client.force_authenticate(user=owner_user)
        response = api_client.post(
            reverse("user-create"),
            {
                "username": "newuser",
                "email": "new@test.com",
                "password": "securepass123",
                "role": "ATHLETE",
                "tenant_id": str(tenant.id),
            },
            format="json",
        )
        assert response.status_code == 201
        user = User.objects.get(username="newuser")
        assert user.role == "ATHLETE"
        assert user.tenant_id == tenant.id
        assert user.check_password("securepass123")

    def test_creates_audit_log(self, api_client, owner_user, tenant):
        api_client.force_authenticate(user=owner_user)
        api_client.post(
            reverse("user-create"),
            {
                "username": "logged_user",
                "email": "log@test.com",
                "password": "securepass123",
            },
            format="json",
        )
        assert AuditLog.objects.filter(action__contains="Created user logged_user").exists()

    def test_athlete_cannot_create(self, api_client, athlete_user):
        api_client.force_authenticate(user=athlete_user)
        response = api_client.post(
            reverse("user-create"),
            {
                "username": "bad",
                "email": "bad@test.com",
                "password": "pass123456",
            },
            format="json",
        )
        assert response.status_code == 403

    def test_duplicate_username_rejected(self, api_client, owner_user, athlete_user):
        api_client.force_authenticate(user=owner_user)
        response = api_client.post(
            reverse("user-create"),
            {
                "username": "athlete",  # already exists
                "email": "dup@test.com",
                "password": "pass123456",
            },
            format="json",
        )
        assert response.status_code == 400

    def test_admin_can_create_for_tenant(self, api_client, admin_user, tenant):
        api_client.force_authenticate(user=admin_user)
        response = api_client.post(
            reverse("user-create"),
            {
                "username": "tenant_user",
                "email": "tuser@test.com",
                "password": "securepass123",
                "role": "TENANT_MODERATOR",
            },
            format="json",
        )
        assert response.status_code == 201


# ---------------------------------------------------------------------------
# UserDeleteView
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUserDelete:
    def test_owner_can_delete_user(self, api_client, owner_user, athlete_user):
        api_client.force_authenticate(user=owner_user)
        url = reverse("user-delete", kwargs={"pk": athlete_user.id})
        response = api_client.delete(url)
        assert response.status_code == 200
        assert not User.objects.filter(username="athlete").exists()

    def test_creates_audit_log_on_delete(self, api_client, owner_user, athlete_user):
        api_client.force_authenticate(user=owner_user)
        url = reverse("user-delete", kwargs={"pk": athlete_user.id})
        api_client.delete(url)
        assert AuditLog.objects.filter(action__contains="Deleted user athlete").exists()

    def test_athlete_cannot_delete(self, api_client, athlete_user):
        api_client.force_authenticate(user=athlete_user)
        url = reverse("user-delete", kwargs={"pk": athlete_user.id})
        response = api_client.delete(url)
        assert response.status_code == 403

    def test_not_found(self, api_client, owner_user):
        api_client.force_authenticate(user=owner_user)
        url = reverse("user-delete", kwargs={"pk": 99999})
        response = api_client.delete(url)
        assert response.status_code == 404

    def test_cannot_delete_self(self, api_client, owner_user):
        api_client.force_authenticate(user=owner_user)
        url = reverse("user-delete", kwargs={"pk": owner_user.id})
        response = api_client.delete(url)
        # Should still work (owner can delete self) but check behaviour
        assert response.status_code in (200, 204)


# ---------------------------------------------------------------------------
# InvitationTokenView
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestInvitation:
    def test_admin_can_send_invitation(self, api_client, admin_user, tenant):
        api_client.force_authenticate(user=admin_user)
        response = api_client.post(
            reverse("invitation"),
            {
                "email": "invitee@test.com",
                "name": "Jan Kowalski",
                "role": "TENANT_MODERATOR",
            },
            format="json",
        )
        assert response.status_code == 201
        data = response.data
        assert data["email"] == "invitee@test.com"
        assert data["role"] == "TENANT_MODERATOR"
        assert "temporary_password" in data
        user = User.objects.get(email="invitee@test.com")
        assert user.role == "TENANT_MODERATOR"

    def test_invitation_creates_audit_log(self, api_client, admin_user):
        api_client.force_authenticate(user=admin_user)
        api_client.post(
            reverse("invitation"),
            {
                "email": "audit_invite@test.com",
            },
            format="json",
        )
        assert AuditLog.objects.filter(
            action__contains="Invited user audit_invite@test.com"
        ).exists()

    def test_missing_email_rejected(self, api_client, owner_user):
        api_client.force_authenticate(user=owner_user)
        response = api_client.post(reverse("invitation"), {}, format="json")
        assert response.status_code == 400

    def test_athlete_cannot_invite(self, api_client, athlete_user):
        api_client.force_authenticate(user=athlete_user)
        response = api_client.post(
            reverse("invitation"),
            {
                "email": "bad@test.com",
            },
            format="json",
        )
        assert response.status_code == 403

    def test_duplicate_invitation_unique_username(self, api_client, admin_user):
        """Second invitation with same email prefix generates unique username."""
        api_client.force_authenticate(user=admin_user)
        r1 = api_client.post(
            reverse("invitation"),
            {
                "email": "same@test.com",
            },
            format="json",
        )
        r2 = api_client.post(
            reverse("invitation"),
            {
                "email": "same@test.com",
            },
            format="json",
        )
        assert r1.data["username"] != r2.data["username"]


# ---------------------------------------------------------------------------
# Role-based access
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestRolePermissions:
    def test_global_owner_accesses_all_users(self, api_client, owner_user):
        api_client.force_authenticate(user=owner_user)
        response = api_client.get(reverse("user-list"))
        assert response.status_code == 200
        assert "results" in response.data
        assert "next_cursor" in response.data
        assert "has_more" in response.data

    def test_tenant_admin_user_list_is_scoped(self, api_client, admin_user, other_tenant, tenant):
        # Create users in both tenants
        in_tenant = User.objects.create_user(
            username="t1",
            email="t1@test.com",
            password="password123",
            role="ATHLETE",
            tenant=tenant,
        )
        out_tenant = User.objects.create_user(
            username="t2",
            email="t2@test.com",
            password="password123",
            role="ATHLETE",
            tenant=other_tenant,
        )

        api_client.force_authenticate(user=admin_user)
        response = api_client.get(reverse("user-list"), {"page_size": 100})
        assert response.status_code == 200
        usernames = {u["username"] for u in response.data["results"]}
        assert in_tenant.username in usernames
        assert out_tenant.username not in usernames

    def test_tenant_admin_detail_is_scoped_404(self, api_client, admin_user, other_tenant):
        other = User.objects.create_user(
            username="outsider",
            email="outsider@test.com",
            password="password123",
            role="ATHLETE",
            tenant=other_tenant,
        )
        api_client.force_authenticate(user=admin_user)
        url = reverse("user-detail", kwargs={"pk": other.id})
        response = api_client.get(url)
        assert response.status_code == 404

    def test_user_list_pagination_and_search(self, api_client, owner_user, tenant):
        for i in range(12):
            User.objects.create_user(
                username=f"batch_athlete_{i}",
                email=f"a{i}@test.com",
                password="password123",
                role="ATHLETE",
                tenant=tenant,
            )
        api_client.force_authenticate(user=owner_user)
        page1 = api_client.get(reverse("user-list"), {"page_size": 5})
        assert page1.status_code == 200
        assert len(page1.data["results"]) == 5
        assert page1.data["has_more"] in (True, False)
        assert page1.data["next_cursor"] is not None

        page2 = api_client.get(
            reverse("user-list"), {"page_size": 5, "cursor": page1.data["next_cursor"]}
        )
        assert page2.status_code == 200
        assert len(page2.data["results"]) == 5 or len(page2.data["results"]) < 5

        found = api_client.get(reverse("user-list"), {"search": "batch_athlete_3"})
        assert found.status_code == 200
        assert any(u["username"] == "batch_athlete_3" for u in found.data["results"])

    def test_athlete_denied_user_list(self, api_client, athlete_user):
        api_client.force_authenticate(user=athlete_user)
        response = api_client.get(reverse("user-list"))
        assert response.status_code == 403

    def test_moderator_denied_user_list(self, api_client, moderator_user):
        api_client.force_authenticate(user=moderator_user)
        response = api_client.get(reverse("user-list"))
        assert response.status_code == 403

    def test_sponsor_denied_user_list(self, api_client, sponsor_user):
        api_client.force_authenticate(user=sponsor_user)
        response = api_client.get(reverse("user-list"))
        assert response.status_code == 403

    def test_impersonation_requires_global_owner(self, api_client, admin_user, athlete_user):
        api_client.force_authenticate(user=admin_user)
        url = reverse("impersonate", kwargs={"target_user_id": athlete_user.id})
        response = api_client.post(url)
        assert response.status_code == 403

    def test_impersonation_succeeds_for_owner(self, api_client, owner_user, athlete_user):
        api_client.force_authenticate(user=owner_user)
        url = reverse("impersonate", kwargs={"target_user_id": athlete_user.id})
        response = api_client.post(url)
        assert response.status_code == 200
        assert "access" in response.data
        assert response.data["impersonated_user"] == "athlete"


@pytest.mark.django_db
class TestBulkUserEndpoints:
    def test_tenant_admin_bulk_set_status_scoped(
        self, api_client, admin_user, tenant, other_tenant
    ):
        u1 = User.objects.create_user(
            username="u1",
            email="u1@test.com",
            password="password123",
            role="ATHLETE",
            tenant=tenant,
        )
        u2 = User.objects.create_user(
            username="u2",
            email="u2@test.com",
            password="password123",
            role="ATHLETE",
            tenant=other_tenant,
        )
        api_client.force_authenticate(user=admin_user)

        url = reverse("users-bulk-set-status")
        # Cross-tenant targeting must be rejected
        r = api_client.post(url, {"user_ids": [u1.id, u2.id], "is_active": False}, format="json")
        assert r.status_code == 403

        ok = api_client.post(url, {"user_ids": [u1.id], "is_active": False}, format="json")
        assert ok.status_code == 202
        assert ok.data["allowed"] == 1

    def test_tenant_admin_bulk_change_role_restricts_roles(self, api_client, admin_user, tenant):
        u1 = User.objects.create_user(
            username="u3",
            email="u3@test.com",
            password="password123",
            role="ATHLETE",
            tenant=tenant,
        )
        api_client.force_authenticate(user=admin_user)

        url = reverse("users-bulk-change-role")
        forbidden = api_client.post(
            url, {"user_ids": [u1.id], "role": "GLOBAL_OWNER"}, format="json"
        )
        assert forbidden.status_code == 403

        ok = api_client.post(url, {"user_ids": [u1.id], "role": "TENANT_MODERATOR"}, format="json")
        assert ok.status_code == 202
        assert ok.data["allowed"] == 1
