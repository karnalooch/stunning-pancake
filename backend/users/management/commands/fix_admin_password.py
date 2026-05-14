"""
Fixes plain text password for global_owner user.
Safe to run multiple times — only updates if password is not hashed.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import is_password_usable

User = get_user_model()


class Command(BaseCommand):
    help = 'Fix plain text password for global_owner user'

    def handle(self, *args, **options):
        try:
            user = User.objects.get(username='global_owner')
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR('User global_owner does not exist.'))
            return

        # Check if password is already properly hashed
        if is_password_usable(user.password) and user.password.startswith('pbkdf2_'):
            self.stdout.write(
                self.style.SUCCESS('Password is already properly hashed. No fix needed.')
            )
            return

        # Password is plain text — fix it
        user.set_password('admin123')
        user.save()
        self.stdout.write(
            self.style.SUCCESS('Fixed password for global_owner. New password: admin123')
        )
