"""
Department Models — Organizational Units within Tenants
========================================================
Supports: company departments, school classes, university faculties,
NGO teams, city districts.
"""

from django.conf import settings
from django.db import models


class Department(models.Model):
    """Organizational unit within a tenant (department, class, faculty, team, district)."""

    DEPARTMENT_TYPES = (
        ("department", "Department"),
        ("class", "Class"),
        ("faculty", "Faculty"),
        ("team", "Team"),
        ("district", "District"),
        ("other", "Other"),
    )

    name = models.CharField(max_length=200)
    tenant = models.ForeignKey("users.Tenant", on_delete=models.CASCADE, related_name="departments")
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children"
    )
    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="moderated_departments",
    )
    department_type = models.CharField(
        max_length=50, choices=DEPARTMENT_TYPES, default="department"
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("tenant", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_department_type_display()})"

    def get_member_count(self):
        """Returns number of users in this department (not including sub-departments)."""
        return self.userdepartment_set.count()

    def get_full_member_count(self):
        """Returns number of users in this department and all sub-departments."""
        count = self.get_member_count()
        for child in self.children.all():
            count += child.get_full_member_count()
        return count


class UserDepartment(models.Model):
    """Through model for User-Department ManyToMany relationship."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "department")
        ordering = ["joined_at"]

    def __str__(self):
        return f"{self.user} → {self.department}"


def resolve_primary_department_id(user) -> int | None:
    """First active department membership (v1 primary dept for live map scope)."""
    if user is None:
        return None
    return (
        UserDepartment.objects.filter(user=user, department__is_active=True)
        .order_by("joined_at")
        .values_list("department_id", flat=True)
        .first()
    )


def ride_scope_from_user(user) -> dict[str, str | int | None]:
    """Denormalized tenant/dept fields stored on live ride + telemetry payloads."""
    tenant_id = None
    if user is not None and getattr(user, "tenant_id", None):
        tenant_id = str(user.tenant_id)
    return {
        "tenant_id": tenant_id,
        "primary_department_id": resolve_primary_department_id(user),
    }
