"""Create deterministic role users for admin p0-role-smoke (idempotent)."""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from users.models import Tenant

User = get_user_model()

SMOKE_PASSWORD = os.getenv("SMOKE_PASSWORD", "SmokeTest123!")
USERS = [
    ("global_owner", "GLOBAL_OWNER", None),
    ("tenant_admin", "TENANT_ADMIN", "smoke-city"),
    ("tenant_moderator", "TENANT_MODERATOR", "smoke-city"),
    ("sponsor_user", "SPONSOR", "smoke-city"),
]


class Command(BaseCommand):
    help = "Seed GLOBAL_OWNER, TENANT_ADMIN, TENANT_MODERATOR, SPONSOR for local smoke tests"

    def handle(self, *args, **options):
        tenant, _ = Tenant.objects.get_or_create(
            name="Smoke City",
            defaults={"is_active": True, "has_heatmap_analytics": True},
        )

        for username, role, tenant_slug in USERS:
            t = tenant if tenant_slug else None
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@smoke.local",
                    "role": role,
                    "tenant": t,
                    "is_staff": role == "GLOBAL_OWNER",
                    "is_superuser": role == "GLOBAL_OWNER",
                },
            )
            if not created:
                user.role = role
                user.tenant = t
                user.is_staff = role == "GLOBAL_OWNER"
                user.is_superuser = role == "GLOBAL_OWNER"
                user.save()
            user.set_password(SMOKE_PASSWORD)
            user.save(update_fields=["password"])

            if role == "SPONSOR":
                from rewards.models import Sponsor

                Sponsor.objects.get_or_create(
                    user=user,
                    defaults={
                        "name": f"{username} sponsor",
                        "tenant_id": str(tenant.id),
                    },
                )

            action = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{action} {username} ({role})"))

        self.stdout.write(self.style.WARNING(f"Password for all: {SMOKE_PASSWORD}"))
