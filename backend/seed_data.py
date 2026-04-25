import os
import django
import uuid

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import User, Tenant, Role
from activities.models import Activity, POI, Voucher
from django.utils import timezone
from datetime import timedelta

def seed():
    print("🌱 Seeding SPORT Platform...")

    # 1. Create Global Owner
    owner, _ = User.objects.get_or_create(
        username='global_owner',
        email='owner@sport-platform.com',
        defaults={'role': 'GLOBAL_OWNER'}
    )
    owner.set_password('admin123')
    owner.save()

    # 2. Create Tenants
    siedlce, _ = Tenant.objects.get_or_create(
        name='Siedlce City',
        defaults={
            'slug': 'siedlce',
            'primary_color': '#2563EB',
            'secondary_color': '#10B981'
        }
    )

    warsaw, _ = Tenant.objects.get_or_create(
        name='Warsaw Runners',
        defaults={
            'slug': 'warsaw',
            'primary_color': '#DC2626',
            'secondary_color': '#FBBF24'
        }
    )

    # 3. Create Tenant Admins
    siedlce_admin, _ = User.objects.get_or_create(
        username='siedlce_admin',
        defaults={'role': 'TENANT_ADMIN', 'tenant': siedlce}
    )
    siedlce_admin.set_password('siedlce123')
    siedlce_admin.save()

    # 4. Create POIs & Vouchers
    coffee_poi, _ = POI.objects.get_or_create(
        name='Eco Coffee Siedlce',
        tenant=siedlce,
        defaults={'latitude': 52.1672, 'longitude': 22.2906}
    )

    Voucher.objects.get_or_create(
        poi=coffee_poi,
        code='COFFEE-20',
        defaults={'discount_percent': 20, 'is_active': True}
    )

    # 5. Create Mock Activities
    athlete, _ = User.objects.get_or_create(
        username='athlete_01',
        defaults={'role': 'ATHLETE', 'tenant': siedlce}
    )

    for i in range(5):
        Activity.objects.get_or_create(
            user=athlete,
            tenant=siedlce,
            type='RUN',
            start_time=timezone.now() - timedelta(days=i),
            defaults={
                'distance': 5000 + (i * 100),
                'duration': timedelta(minutes=25 + i),
                'verification_score': 0.1,
                'is_verified': True
            }
        )

    print("✅ Seeding complete. Use 'global_owner / admin123' to log in.")

if __name__ == "__main__":
    seed()
