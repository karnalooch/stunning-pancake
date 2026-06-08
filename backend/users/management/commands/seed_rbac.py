"""
Seeds the RBAC permission and role tables.
Safe to run multiple times — uses get_or_create.
"""

from django.core.management.base import BaseCommand

from users.rbac_models import Permission, Role, RolePermission

PERMISSIONS = [
    # Activities
    ("activities.view", "View Activities", "activities", "view", "Can view activity details"),
    ("activities.create", "Create Activities", "activities", "create", "Can create new activities"),
    ("activities.edit", "Edit Activities", "activities", "edit", "Can edit activities"),
    ("activities.delete", "Delete Activities", "activities", "delete", "Can delete activities"),
    (
        "activities.approve",
        "Approve Activities",
        "activities",
        "approve",
        "Can approve/reject activities",
    ),
    (
        "activities.view_all",
        "View All Activities",
        "activities",
        "view_all",
        "Can view all activities (cross-tenant)",
    ),
    # Users
    ("users.view", "View Users", "users", "view", "Can view user profiles"),
    ("users.create", "Create Users", "users", "create", "Can create new users"),
    ("users.edit", "Edit Users", "users", "edit", "Can edit user profiles"),
    ("users.delete", "Delete Users", "users", "delete", "Can delete users"),
    (
        "users.impersonate",
        "Impersonate Users",
        "users",
        "impersonate",
        "Can impersonate other users",
    ),
    ("users.view_all", "View All Users", "users", "view_all", "Can view all users (cross-tenant)"),
    # Tenants
    ("tenants.view", "View Tenants", "tenants", "view", "Can view tenant details"),
    ("tenants.create", "Create Tenants", "tenants", "create", "Can create new tenants"),
    ("tenants.edit", "Edit Tenants", "tenants", "edit", "Can edit tenant settings"),
    ("tenants.delete", "Delete Tenants", "tenants", "delete", "Can delete tenants"),
    ("tenants.view_all", "View All Tenants", "tenants", "view_all", "Can view all tenants"),
    # POI & Vouchers
    ("poi.view", "View POIs", "poi", "view", "Can view points of interest"),
    ("poi.create", "Create POIs", "poi", "create", "Can create POIs"),
    ("poi.edit", "Edit POIs", "poi", "edit", "Can edit POIs"),
    ("poi.delete", "Delete POIs", "poi", "delete", "Can delete POIs"),
    ("vouchers.create", "Create Vouchers", "vouchers", "create", "Can create vouchers"),
    ("vouchers.view", "View Vouchers", "vouchers", "view", "Can view vouchers"),
    # Analytics
    ("analytics.view", "View Analytics", "analytics", "view", "Can view analytics dashboards"),
    ("analytics.export", "Export Analytics", "analytics", "export", "Can export analytics data"),
    # Departments
    ("departments.view", "View Departments", "departments", "view", "Can view departments"),
    ("departments.create", "Create Departments", "departments", "create", "Can create departments"),
    ("departments.edit", "Edit Departments", "departments", "edit", "Can edit departments"),
    ("departments.delete", "Delete Departments", "departments", "delete", "Can delete departments"),
    (
        "departments.view_users",
        "View Department Users",
        "departments",
        "view_users",
        "Can view users in department",
    ),
    (
        "departments.assign_users",
        "Assign Users to Department",
        "departments",
        "assign_users",
        "Can assign users to department",
    ),
    (
        "departments.remove_users",
        "Remove Users from Department",
        "departments",
        "remove_users",
        "Can remove users from department",
    ),
    (
        "departments.view_activities",
        "View Department Activities",
        "departments",
        "view_activities",
        "Can view activities in department",
    ),
    (
        "departments.view_analytics",
        "View Department Analytics",
        "departments",
        "view_analytics",
        "Can view department analytics",
    ),
    # System
    (
        "system.config",
        "System Configuration",
        "system",
        "config",
        "Can modify system configuration",
    ),
    (
        "system.impersonate",
        "System Impersonation",
        "system",
        "impersonate",
        "Can impersonate any user",
    ),
]

ROLE_PERMISSIONS = {
    "global_owner": [p[0] for p in PERMISSIONS],  # All permissions
    "tenant_admin": [
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
    "tenant_moderator": [
        "activities.view",
        "activities.approve",
        "users.view",
        "tenants.view",
        "poi.view",
        "vouchers.view",
        "analytics.view",
    ],
    "sponsor": [
        "activities.view",
        "poi.view",
        "poi.create",
        "poi.edit",
        "vouchers.create",
        "vouchers.view",
        "analytics.view",
    ],
    "department_moderator": [
        "activities.view",
        "activities.approve",
        "users.view",
        "tenants.view",
        "poi.view",
        "vouchers.view",
        "analytics.view",
        "departments.view",
        "departments.view_users",
        "departments.view_activities",
        "departments.view_analytics",
    ],
    "athlete": [
        "activities.view",
        "activities.create",
        "users.view",
        "poi.view",
        "vouchers.view",
    ],
}


class Command(BaseCommand):
    help = "Seed RBAC permissions and roles"

    def handle(self, *args, **options):
        self.stdout.write("Seeding permissions...")
        perm_map = {}
        for codename, name, resource, action, description in PERMISSIONS:
            perm, _ = Permission.objects.get_or_create(
                codename=codename,
                defaults={
                    "name": name,
                    "resource": resource,
                    "action": action,
                    "description": description,
                },
            )
            perm_map[codename] = perm
        self.stdout.write(self.style.SUCCESS(f"  Created {len(perm_map)} permissions"))

        self.stdout.write("Seeding roles...")
        for slug, name in Role.SLUG_CHOICES:
            role, _ = Role.objects.get_or_create(
                slug=slug, defaults={"name": name, "description": f"System role: {name}"}
            )
            # Assign permissions
            perm_codenames = ROLE_PERMISSIONS.get(slug, [])
            for codename in perm_codenames:
                if codename in perm_map:
                    RolePermission.objects.get_or_create(role=role, permission=perm_map[codename])
            self.stdout.write(
                self.style.SUCCESS(f'  Role "{slug}" with {len(perm_codenames)} permissions')
            )

        self.stdout.write(self.style.SUCCESS("RBAC seeding complete."))
