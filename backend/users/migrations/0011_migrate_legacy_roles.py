"""
Data migration: Migrate existing User.role values to UserRole assignments.
Backward-compatible: keeps User.role field for legacy code.
"""
from django.db import migrations


def migrate_legacy_roles(apps, schema_editor):
    User = apps.get_model('users', 'User')
    Role = apps.get_model('users', 'Role')
    UserRole = apps.get_model('users', 'UserRole')

    role_map = {
        'GLOBAL_OWNER': 'global_owner',
        'TENANT_ADMIN': 'tenant_admin',
        'TENANT_MODERATOR': 'tenant_moderator',
        'SPONSOR': 'sponsor',
        'ATHLETE': 'athlete',
    }

    for user in User.objects.all():
        legacy_role = getattr(user, 'role', None)
        if legacy_role and legacy_role in role_map:
            role_slug = role_map[legacy_role]
            try:
                role = Role.objects.get(slug=role_slug)
                UserRole.objects.get_or_create(
                    user=user,
                    role=role,
                    tenant=user.tenant,
                )
            except Role.DoesNotExist:
                pass


def reverse_migrate_legacy_roles(apps, schema_editor):
    UserRole = apps.get_model('users', 'UserRole')
    UserRole.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0010_seed_rbac_data'),
    ]

    operations = [
        migrations.RunPython(migrate_legacy_roles, reverse_code=reverse_migrate_legacy_roles),
    ]
