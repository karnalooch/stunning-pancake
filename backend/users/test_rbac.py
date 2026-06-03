"""
Unit Tests — RBAC System
=========================
Tests for Permission, Role, RolePermission, UserRole models,
permission classes, and migration logic.
"""

import pytest
from django.contrib.auth import get_user_model
from users.rbac_models import Permission, Role, RolePermission, UserRole
from users.permissions import (
    HasPermission,
    HasAnyPermission,
    IsGlobalOwner,
    IsTenantAdmin,
    IsAdminOrModerator,
)
from users.models import Tenant

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def tenant(db):
    return Tenant.objects.create(name="Test City", is_active=True)


@pytest.fixture
def global_owner(db):
    return User.objects.create_user(username="go", password="pass", role="GLOBAL_OWNER")


@pytest.fixture
def tenant_admin(db, tenant):
    return User.objects.create_user(
        username="ta", password="pass", role="TENANT_ADMIN", tenant=tenant
    )


@pytest.fixture
def tenant_moderator(db, tenant):
    return User.objects.create_user(
        username="tm", password="pass", role="TENANT_MODERATOR", tenant=tenant
    )


@pytest.fixture
def athlete(db, tenant):
    return User.objects.create_user(username="ath", password="pass", role="ATHLETE", tenant=tenant)


@pytest.fixture
def rbac_roles(db):
    """Ensure RBAC roles exist (from migration or manual creation)."""
    for slug, name in Role.SLUG_CHOICES:
        Role.objects.get_or_create(slug=slug, defaults={"name": name})


@pytest.fixture
def rbac_permissions(db):
    """Create test permissions."""
    perms = [
        ("activities.view", "View Activities", "activities", "view"),
        ("activities.approve", "Approve Activities", "activities", "approve"),
        ("users.impersonate", "Impersonate Users", "users", "impersonate"),
        ("system.config", "System Configuration", "system", "config"),
    ]
    created = []
    for codename, name, resource, action in perms:
        p, _ = Permission.objects.get_or_create(
            codename=codename, defaults={"name": name, "resource": resource, "action": action}
        )
        created.append(p)
    return created


# ---------------------------------------------------------------------------
# Model Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestPermissionModel:
    def test_unique_codename(self, rbac_permissions):
        with pytest.raises(Exception):  # IntegrityError
            Permission.objects.create(
                codename="activities.view", name="Dup", resource="x", action="x"
            )

    def test_unique_resource_action(self, rbac_permissions):
        with pytest.raises(Exception):
            Permission.objects.create(
                codename="unique.code", name="Dup", resource="activities", action="view"
            )

    def test_str_representation(self, rbac_permissions):
        perm = rbac_permissions[0]
        assert str(perm) == f"{perm.codename} ({perm.name})"


@pytest.mark.django_db
class TestRoleModel:
    def test_role_creation(self, rbac_roles):
        role = Role.objects.get(slug="global_owner")
        assert role.is_system is True

    def test_system_role_cannot_be_deleted(self, rbac_roles):
        role = Role.objects.get(slug="global_owner")
        assert role.is_system is True


@pytest.mark.django_db
class TestUserRoleModel:
    def test_assign_role_to_user(self, global_owner, rbac_roles):
        role = Role.objects.get(slug="global_owner")
        ur = UserRole.objects.create(user=global_owner, role=role)
        assert ur.user == global_owner
        assert ur.role == role

    def test_unique_user_role_tenant(self, global_owner, tenant, rbac_roles):
        role = Role.objects.get(slug="global_owner")
        UserRole.objects.create(user=global_owner, role=role, tenant=tenant)
        with pytest.raises(Exception):
            UserRole.objects.create(user=global_owner, role=role, tenant=tenant)

    def test_role_expiry(self, global_owner, rbac_roles):
        from django.utils import timezone
        from datetime import timedelta

        role = Role.objects.get(slug="athlete")
        expires = timezone.now() + timedelta(days=30)
        ur = UserRole.objects.create(user=global_owner, role=role, expires_at=expires)
        assert ur.expires_at is not None


# ---------------------------------------------------------------------------
# User Helper Method Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUserRBACMethods:
    def test_get_permissions_empty(self, athlete, rbac_roles):
        """User with no UserRole assignments has no permissions."""
        perms = athlete.get_permissions()
        assert perms == set()

    def test_get_permissions_via_role(self, athlete, rbac_roles, rbac_permissions):
        """User gets permissions through UserRole → Role → Permission."""
        role = Role.objects.get(slug="athlete")
        # Assign some permissions to the athlete role
        for perm in rbac_permissions[:2]:
            RolePermission.objects.get_or_create(role=role, permission=perm)

        UserRole.objects.create(user=athlete, role=role)
        perms = athlete.get_permissions()
        assert "activities.view" in perms

    def test_has_perm(self, athlete, rbac_roles, rbac_permissions):
        role = Role.objects.get(slug="athlete")
        perm = rbac_permissions[0]
        RolePermission.objects.get_or_create(role=role, permission=perm)
        UserRole.objects.create(user=athlete, role=role)
        assert athlete.has_perm("activities.view") is True
        assert athlete.has_perm("system.config") is False

    def test_has_role(self, athlete, rbac_roles):
        role = Role.objects.get(slug="athlete")
        UserRole.objects.create(user=athlete, role=role)
        assert athlete.has_role("athlete") is True
        assert athlete.has_role("global_owner") is False


# ---------------------------------------------------------------------------
# Permission Class Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestPermissionClasses:
    def test_has_permission_granted(self, athlete, rbac_roles, rbac_permissions):
        role = Role.objects.get(slug="athlete")
        perm = rbac_permissions[0]
        RolePermission.objects.get_or_create(role=role, permission=perm)
        UserRole.objects.create(user=athlete, role=role)

        checker = HasPermission("activities.view")
        request = type("Request", (), {"user": athlete})()
        assert checker.has_permission(request, None) is True

    def test_has_permission_denied(self, athlete, rbac_roles):
        checker = HasPermission("system.config")
        request = type("Request", (), {"user": athlete})()
        assert checker.has_permission(request, None) is False

    def test_has_permission_unauthenticated(self):
        checker = HasPermission("activities.view")
        request = type("Request", (), {"user": type("User", (), {"is_authenticated": False})()})()
        assert checker.has_permission(request, None) is False

    def test_has_any_permission(self, athlete, rbac_roles, rbac_permissions):
        role = Role.objects.get(slug="athlete")
        perm = rbac_permissions[0]
        RolePermission.objects.get_or_create(role=role, permission=perm)
        UserRole.objects.create(user=athlete, role=role)

        checker = HasAnyPermission(["activities.view", "system.config"])
        request = type("Request", (), {"user": athlete})()
        assert checker.has_permission(request, None) is True

    def test_is_global_owner(self, global_owner):
        checker = IsGlobalOwner()
        request = type("Request", (), {"user": global_owner})()
        assert checker.has_permission(request, None) is True

    def test_is_global_owner_denied(self, athlete):
        checker = IsGlobalOwner()
        request = type("Request", (), {"user": athlete})()
        assert checker.has_permission(request, None) is False

    def test_is_tenant_admin(self, tenant_admin):
        checker = IsTenantAdmin()
        request = type("Request", (), {"user": tenant_admin})()
        assert checker.has_permission(request, None) is True

    def test_is_admin_or_moderator(self, tenant_moderator):
        checker = IsAdminOrModerator()
        request = type("Request", (), {"user": tenant_moderator})()
        assert checker.has_permission(request, None) is True


@pytest.mark.django_db
class TestRoleApi:
    def test_global_owner_can_patch_role_permissions(
        self, global_owner, rbac_roles, rbac_permissions
    ):
        from rest_framework.test import APIClient

        role = Role.objects.get(slug="athlete")
        client = APIClient()
        client.force_authenticate(user=global_owner)
        perm_ids = [p.id for p in rbac_permissions[:2]]
        response = client.patch(
            f"/api/users/rbac/roles/{role.id}/",
            {"permission_ids": perm_ids},
            format="json",
        )
        assert response.status_code == 200
        assert RolePermission.objects.filter(role=role).count() == 2
