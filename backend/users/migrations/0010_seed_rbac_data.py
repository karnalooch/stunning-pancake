"""
Data migration: Seed RBAC permissions and roles.
"""
from django.db import migrations

PERMISSIONS = [
    ('activities.view', 'View Activities', 'activities', 'view', 'Can view activity details'),
    ('activities.create', 'Create Activities', 'activities', 'create', 'Can create new activities'),
    ('activities.edit', 'Edit Activities', 'activities', 'edit', 'Can edit activities'),
    ('activities.delete', 'Delete Activities', 'activities', 'delete', 'Can delete activities'),
    ('activities.approve', 'Approve Activities', 'activities', 'approve', 'Can approve/reject activities'),
    ('activities.view_all', 'View All Activities', 'activities', 'view_all', 'Can view all activities (cross-tenant)'),
    ('users.view', 'View Users', 'users', 'view', 'Can view user profiles'),
    ('users.create', 'Create Users', 'users', 'create', 'Can create new users'),
    ('users.edit', 'Edit Users', 'users', 'edit', 'Can edit user profiles'),
    ('users.delete', 'Delete Users', 'users', 'delete', 'Can delete users'),
    ('users.impersonate', 'Impersonate Users', 'users', 'impersonate', 'Can impersonate other users'),
    ('users.view_all', 'View All Users', 'users', 'view_all', 'Can view all users (cross-tenant)'),
    ('tenants.view', 'View Tenants', 'tenants', 'view', 'Can view tenant details'),
    ('tenants.create', 'Create Tenants', 'tenants', 'create', 'Can create new tenants'),
    ('tenants.edit', 'Edit Tenants', 'tenants', 'edit', 'Can edit tenant settings'),
    ('tenants.delete', 'Delete Tenants', 'tenants', 'delete', 'Can delete tenants'),
    ('tenants.view_all', 'View All Tenants', 'tenants', 'view_all', 'Can view all tenants'),
    ('poi.view', 'View POIs', 'poi', 'view', 'Can view points of interest'),
    ('poi.create', 'Create POIs', 'poi', 'create', 'Can create POIs'),
    ('poi.edit', 'Edit POIs', 'poi', 'edit', 'Can edit POIs'),
    ('poi.delete', 'Delete POIs', 'poi', 'delete', 'Can delete POIs'),
    ('vouchers.create', 'Create Vouchers', 'vouchers', 'create', 'Can create vouchers'),
    ('vouchers.view', 'View Vouchers', 'vouchers', 'view', 'Can view vouchers'),
    ('analytics.view', 'View Analytics', 'analytics', 'view', 'Can view analytics dashboards'),
    ('analytics.export', 'Export Analytics', 'analytics', 'export', 'Can export analytics data'),
    ('system.config', 'System Configuration', 'system', 'config', 'Can modify system configuration'),
    ('system.impersonate', 'System Impersonation', 'system', 'impersonate', 'Can impersonate any user'),
]

ROLE_PERMISSIONS = {
    'global_owner': [p[0] for p in PERMISSIONS],
    'tenant_admin': [
        'activities.view', 'activities.create', 'activities.edit', 'activities.delete', 'activities.approve',
        'users.view', 'users.create', 'users.edit',
        'tenants.view', 'tenants.edit',
        'poi.view', 'poi.create', 'poi.edit', 'poi.delete',
        'vouchers.create', 'vouchers.view',
        'analytics.view', 'analytics.export',
    ],
    'tenant_moderator': [
        'activities.view', 'activities.approve',
        'users.view',
        'tenants.view',
        'poi.view',
        'vouchers.view',
        'analytics.view',
    ],
    'sponsor': [
        'activities.view',
        'poi.view', 'poi.create', 'poi.edit',
        'vouchers.create', 'vouchers.view',
        'analytics.view',
    ],
    'athlete': [
        'activities.view', 'activities.create',
        'users.view',
        'poi.view',
        'vouchers.view',
    ],
}


def seed_rbac_data(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')
    RolePermission = apps.get_model('users', 'RolePermission')

    # Create permissions
    perm_map = {}
    for codename, name, resource, action, description in PERMISSIONS:
        perm = Permission.objects.create(
            codename=codename, name=name, resource=resource, action=action, description=description
        )
        perm_map[codename] = perm

    # Create roles and assign permissions
    for slug, name in Role._meta.get_field('slug').choices:
        role = Role.objects.create(slug=slug, name=name, description=f'System role: {name}')
        for codename in ROLE_PERMISSIONS.get(slug, []):
            if codename in perm_map:
                RolePermission.objects.create(role=role, permission=perm_map[codename])


def reverse_seed_rbac_data(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')
    RolePermission = apps.get_model('users', 'RolePermission')
    RolePermission.objects.all().delete()
    Permission.objects.all().delete()
    Role.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_rbac_models'),
    ]

    operations = [
        migrations.RunPython(seed_rbac_data, reverse_code=reverse_seed_rbac_data),
    ]
