import os
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.crypto import get_random_string

from activities.models import Activity
from users.models import Tenant, User


class Command(BaseCommand):
    help = "Seeds 4VELO with isolated demonstration data"

    def handle(self, *args, **options):
        self.stdout.write("Seeding 4VELO demonstration data...")
        configured_password = os.getenv("DEMO_USER_PASSWORD")
        demo_password = configured_password or get_random_string(20)

        # 1. Create Tenants
        siedlce, created = Tenant.objects.get_or_create(
            name="Siedlce City",
            defaults={
                "primary_color": "#2563EB",
                "secondary_color": "#10B981",
            },
        )
        self.stdout.write(
            self.style.SUCCESS(f"Tenant Siedlce: {'created' if created else 'already exists'}")
        )

        warsaw, created = Tenant.objects.get_or_create(
            name="Warsaw Runners",
            defaults={
                "primary_color": "#DC2626",
                "secondary_color": "#FBBF24",
            },
        )
        self.stdout.write(
            self.style.SUCCESS(f"Tenant Warsaw: {'created' if created else 'already exists'}")
        )

        # 2. Create Tenant Admins
        siedlce_admin, created = User.objects.get_or_create(
            username="siedlce_admin",
            defaults={"role": "TENANT_ADMIN", "tenant": siedlce},
        )
        if created:
            siedlce_admin.set_password(demo_password)
            siedlce_admin.save(update_fields=["password"])

        # Create athletes
        athlete, _ = User.objects.get_or_create(
            username="athlete_01",
            defaults={"role": "ATHLETE", "tenant": siedlce},
        )
        if not athlete.has_usable_password():
            athlete.set_password(demo_password)
            athlete.save(update_fields=["password"])

        athlete_w, athlete_w_created = User.objects.get_or_create(
            username="athlete_warsaw",
            defaults={"role": "ATHLETE", "tenant": warsaw},
        )
        if athlete_w_created:
            athlete_w.set_password(demo_password)
            athlete_w.save(update_fields=["password"])
        self.stdout.write(
            self.style.SUCCESS(
                f"Athlete athlete_warsaw: {'created' if athlete_w_created else 'already exists'}"
            )
        )

        if athlete_w_created:
            Activity.objects.get_or_create(
                user=athlete_w,
                tenant=warsaw,
                type="BIKE",
                start_time=timezone.now(),
                defaults={
                    "distance": 15000,
                    "duration": timedelta(minutes=45),
                    "verification_score": 0.9,
                    "is_verified": True,
                },
            )
            self.stdout.write(self.style.SUCCESS("Created BIKE activity for athlete_warsaw"))

        self.stdout.write(self.style.SUCCESS("Seeding complete."))
        if not configured_password:
            self.stdout.write(self.style.WARNING(f"Generated demo user password: {demo_password}"))
