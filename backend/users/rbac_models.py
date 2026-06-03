"""
RBAC Models — Role-Based Access Control
=========================================
New permission system with granular permissions.
Backward-compatible: old User.role field is preserved during transition.
"""

import uuid
from django.db import models
from django.conf import settings


class Permission(models.Model):
    """Granular permission (e.g., 'activities.view', 'users.impersonate')."""

    codename = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    resource = models.CharField(max_length=50)  # 'activities', 'users', 'tenants', etc.
    action = models.CharField(max_length=50)  # 'view', 'create', 'edit', 'delete', 'approve'

    class Meta:
        ordering = ["resource", "action"]
        unique_together = ["resource", "action"]

    def __str__(self):
        return f"{self.codename} ({self.name})"


class Role(models.Model):
    """System role with a set of permissions."""

    SLUG_CHOICES = [
        ("global_owner", "Global Owner"),
        ("tenant_admin", "Tenant Admin"),
        ("tenant_moderator", "Tenant Moderator"),
        ("department_moderator", "Department Moderator"),
        ("sponsor", "Sponsor"),
        ("athlete", "Athlete"),
    ]
    slug = models.CharField(max_length=50, unique=True, choices=SLUG_CHOICES)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(Permission, through="RolePermission", blank=True)
    is_system = models.BooleanField(default=True)  # System roles can't be deleted
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["slug"]

    def __str__(self):
        return self.name


class RolePermission(models.Model):
    """Through model for Role-Permission with optional tenant scoping."""

    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    tenant_scoped = models.BooleanField(default=False)  # Permission limited to user's tenant

    class Meta:
        unique_together = ["role", "permission"]

    def __str__(self):
        return f"{self.role} → {self.permission}"


class UserRole(models.Model):
    """User-role assignment with optional tenant scoping and expiry."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="role_assignments"
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    tenant = models.ForeignKey("users.Tenant", on_delete=models.SET_NULL, null=True, blank=True)
    tenant_scoped = models.BooleanField(default=False)  # Permission limited to user's tenant
    expires_at = models.DateTimeField(null=True, blank=True)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="granted_roles"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "role", "tenant"]
        ordering = ["-created_at"]

    def __str__(self):
        tenant_str = f" (tenant: {self.tenant})" if self.tenant else ""
        return f"{self.user} → {self.role}{tenant_str}"
