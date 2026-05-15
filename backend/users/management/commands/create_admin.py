"""
Creates a GLOBAL_OWNER admin user for the admin panel.
Safe to run multiple times — skips if user already exists.
"""
import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils.crypto import get_random_string

User = get_user_model()

ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'global_owner')
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin@4velo.app')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD')


class Command(BaseCommand):
    help = 'Create a GLOBAL_OWNER admin user (safe to run multiple times)'

    def handle(self, *args, **options):
        if User.objects.filter(username=ADMIN_USERNAME).exists():
            self.stdout.write(
                self.style.SUCCESS(f'Admin user "{ADMIN_USERNAME}" already exists.')
            )
            return

        password = ADMIN_PASSWORD
        if not password:
            password = get_random_string(20)

        user = User.objects.create_superuser(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            password=password,
            role='GLOBAL_OWNER',
        )

        # Also create RBAC role assignment
        from users.rbac_models import Role, UserRole
        try:
            role = Role.objects.get(slug='global_owner')
            UserRole.objects.get_or_create(user=user, role=role)
        except Role.DoesNotExist:
            pass  # RBAC not seeded yet, will be handled by migration

        msg = f'Created admin user: {ADMIN_USERNAME} (role=GLOBAL_OWNER, email={ADMIN_EMAIL})'
        if not ADMIN_PASSWORD:
            msg += f'\nGenerated password: {password} (set ADMIN_PASSWORD env var to change)'

        self.stdout.write(self.style.SUCCESS(msg))
