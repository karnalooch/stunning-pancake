import os

import django
from django.contrib.gis.geos import Point
from django.utils.crypto import get_random_string

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from datetime import timedelta

from django.utils import timezone

from activities.models import POI, Activity, Voucher
from users.models import Tenant, User


def _get_or_create_poi(*, name: str, tenant, defaults: dict | None = None):
    """
    Idempotent POI seed — tolerates duplicate rows (no unique on name+tenant).
    Keeps the oldest row and removes extras so get_or_create does not explode.
    """
    defaults = defaults or {}
    qs = POI.objects.filter(name=name, tenant=tenant).order_by("pk")
    existing = qs.first()
    if existing is not None:
        dupes = qs.exclude(pk=existing.pk)
        if dupes.exists():
            dupes.delete()
        return existing, False
    return POI.objects.create(name=name, tenant=tenant, **defaults), True


def seed():
    print("🌱 Seeding 4VELO demonstration data...")

    configured_demo_password = os.getenv("DEMO_USER_PASSWORD")
    demo_password = configured_demo_password or get_random_string(20)
    generated_demo_password = not configured_demo_password

    # 1. Create Global Owner
    owner, owner_created = User.objects.get_or_create(
        username="global_owner",
        defaults={
            "email": "owner@sport-platform.com",
            "role": "GLOBAL_OWNER",
            "is_staff": True,
            "is_superuser": True,
        },
    )
    owner.is_staff = True
    owner.is_superuser = True
    if owner_created:
        owner_password = os.getenv("ADMIN_PASSWORD") or os.getenv("GLOBAL_OWNER_PASSWORD")
        if owner_password:
            owner.set_password(owner_password)
        else:
            owner.set_unusable_password()
    owner.save()

    # 2. Create Tenants
    siedlce, _ = Tenant.objects.get_or_create(
        name="Siedlce City", defaults={"primary_color": "#2563EB", "secondary_color": "#10B981"}
    )

    warsaw, _ = Tenant.objects.get_or_create(
        name="Warsaw Runners", defaults={"primary_color": "#DC2626", "secondary_color": "#FBBF24"}
    )

    # 3. Create Tenant Admins
    siedlce_admin, siedlce_admin_created = User.objects.get_or_create(
        username="siedlce_admin", defaults={"role": "TENANT_ADMIN", "tenant": siedlce}
    )
    if siedlce_admin_created:
        siedlce_admin.set_password(demo_password)
        siedlce_admin.save(update_fields=["password"])

    # 4. Create POIs & Vouchers
    coffee_poi, _ = _get_or_create_poi(
        name="Eco Coffee Siedlce",
        tenant=siedlce,
        defaults={"location": Point(22.2906, 52.1672)},  # lon, lat
    )

    # Voucher — delete any old one first, then create fresh
    Voucher.objects.filter(code="COFFEE-20").delete()
    Voucher.objects.create(
        poi=coffee_poi,
        code="COFFEE-20",
        discount_value="20%",
        expiry_date=timezone.now() + timedelta(days=30),
    )

    # 5. Create Mock Activities
    athlete, athlete_created = User.objects.get_or_create(
        username="athlete_01", defaults={"role": "ATHLETE", "tenant": siedlce}
    )
    if athlete_created:
        athlete.set_password(demo_password)
        athlete.save(update_fields=["password"])

    for i in range(5):
        Activity.objects.get_or_create(
            user=athlete,
            tenant=siedlce,
            type="RUN",
            start_time=timezone.now() - timedelta(days=i),
            defaults={
                "distance": 5000 + (i * 100),
                "duration": timedelta(minutes=25 + i),
                "verification_score": 0.1,
                "is_verified": True,
            },
        )

    # 6. Create Mock for Warsaw
    athlete_w, athlete_w_created = User.objects.get_or_create(
        username="athlete_warsaw", defaults={"role": "ATHLETE", "tenant": warsaw}
    )
    if athlete_w_created:
        athlete_w.set_password(demo_password)
        athlete_w.save(update_fields=["password"])
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

    # 7. Seed RBAC system
    from django.core.management import call_command

    call_command("seed_rbac")
    print("✅ RBAC system seeded.")

    print("✅ Demonstration data seeding complete.")
    if generated_demo_password:
        print(f"⚠️ Generated one-time demo user password: {demo_password}")
    print("Global owner credentials are managed separately by `python manage.py create_admin`.")


if __name__ == "__main__":
    seed()
