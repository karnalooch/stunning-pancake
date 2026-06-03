"""
Department Models — Organizational Units within Tenants
========================================================
Supports: company departments, school classes, university faculties,
NGO teams, city districts.
"""

from django.db import models
from django.conf import settings


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
