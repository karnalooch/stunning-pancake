"""
RBAC Permission Classes
========================
New permission system with granular checks.
Falls back to legacy role-based checks during transition.
"""

from rest_framework import permissions


class HasPermission(permissions.BasePermission):
    """
    Checks if user has a specific permission codename.
    Falls back to legacy role-based check if RBAC system is not fully migrated.

    Usage:
        permission_classes = [HasPermission('activities.approve')]
    """

    def __init__(self, permission_codename):
        self.permission_codename = permission_codename

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Try new RBAC system first
        if hasattr(request.user, "has_perm"):
            tenant_id = getattr(request.user, "tenant_id", None)
            if request.user.has_perm(self.permission_codename, tenant_id):
                return True

        # Fallback to legacy role-based check
        return self._legacy_check(request)

    def _legacy_check(self, request):
        """Legacy role-based permission check during transition."""
        role = getattr(request.user, "role", None)
        perm = self.permission_codename

        # Map permissions to legacy roles
        role_perms = {
            "GLOBAL_OWNER": True,  # Global owner has all permissions
            "TENANT_ADMIN": [
                "activities.view",
                "activities.create",
                "activities.edit",
                "activities.delete",
                "activities.approve",
                "users.view",
                "users.create",
                "users.edit",
                "tenants.view",
                "tenants.edit",
                "poi.view",
                "poi.create",
                "poi.edit",
                "poi.delete",
                "vouchers.create",
                "vouchers.view",
                "analytics.view",
                "analytics.export",
            ],
            "TENANT_MODERATOR": [
                "activities.view",
                "activities.approve",
                "users.view",
                "tenants.view",
                "poi.view",
                "vouchers.view",
                "analytics.view",
            ],
            "SPONSOR": [
                "activities.view",
                "poi.view",
                "poi.create",
                "poi.edit",
                "vouchers.create",
                "vouchers.view",
                "analytics.view",
            ],
            "ATHLETE": [
                "activities.view",
                "activities.create",
                "users.view",
                "poi.view",
                "vouchers.view",
            ],
        }

        allowed = role_perms.get(role, [])
        if allowed is True:
            return True
        return perm in allowed


class IsGlobalOwner(permissions.BasePermission):
    """Legacy: allows only GLOBAL_OWNER. Kept for backward compatibility."""

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and getattr(request.user, "role", None) == "GLOBAL_OWNER"
        )


class IsTenantAdmin(permissions.BasePermission):
    """Legacy: allows TENANT_ADMIN and GLOBAL_OWNER. Kept for backward compatibility."""

    def has_permission(self, request, view):
        role = getattr(request.user, "role", None)
        return request.user.is_authenticated and role in ("GLOBAL_OWNER", "TENANT_ADMIN")


class IsAdminOrModerator(permissions.BasePermission):
    """Legacy: allows GLOBAL_OWNER, TENANT_ADMIN, TENANT_MODERATOR. Kept for backward compatibility."""

    def has_permission(self, request, view):
        role = getattr(request.user, "role", None)
        return request.user.is_authenticated and role in (
            "GLOBAL_OWNER",
            "TENANT_ADMIN",
            "TENANT_MODERATOR",
        )


class HasAnyPermission(permissions.BasePermission):
    """
    Checks if user has ANY of the specified permissions.

    Usage:
        permission_classes = [HasAnyPermission(['activities.view', 'activities.create'])]
    """

    def __init__(self, permission_codenames):
        self.permission_codenames = permission_codenames

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        tenant_id = getattr(request.user, "tenant_id", None)
        if hasattr(request.user, "get_permissions"):
            user_perms = request.user.get_permissions(tenant_id)
            return bool(set(self.permission_codenames) & user_perms)

        # Fallback to legacy
        for perm in self.permission_codenames:
            checker = HasPermission(perm)
            if checker.has_permission(request, view):
                return True
        return False
