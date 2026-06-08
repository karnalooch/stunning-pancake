"""
Fixes plain text password for global_owner user.
Safe to run multiple times — only updates if password is not hashed.
"""

import os

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import is_password_usable
from django.core.management.base import BaseCommand
from django.utils.crypto import get_random_string

User = get_user_model()


class Command(BaseCommand):
    help = "Fix plain text password for global_owner user"

    def handle(self, *args, **options):
        try:
            user = User.objects.get(username="global_owner")
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR("User global_owner does not exist."))
            return

        # Check if password is already properly hashed
        if is_password_usable(user.password) and user.password.startswith("pbkdf2_"):
            self.stdout.write(
                self.style.SUCCESS("Password is already properly hashed. No fix needed.")
            )
            return

        # Password is plain text — fix it
        password = os.getenv("ADMIN_PASSWORD")
        if not password:
            password = get_random_string(20)
            self.stdout.write(
                self.style.WARNING(
                    f"No ADMIN_PASSWORD env var set. Generated one-time password: {password}"
                )
            )

        user.set_password(password)
        user.save()
        self.stdout.write(
            self.style.SUCCESS(
                "Fixed password for global_owner. Set ADMIN_PASSWORD env var to change it."
            )
        )
