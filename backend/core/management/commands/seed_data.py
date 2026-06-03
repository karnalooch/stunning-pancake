import os
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point
from django.utils import timezone
from datetime import timedelta
from users.models import User, Tenant
from activities.models import Activity, POI, Voucher


class Command(BaseCommand):
    help = 'Seeds the SPORT platform with demo data (tenants, POIs, mock activities)'

    def handle(self, *args, **options):
        self.stdout.write('Seeding SPORT Platform...')

        # 1. Create Tenants
        siedlce, created = Tenant.objects.get_or_create(
            name='Siedlce City',
            defaults={
                'primary_color': '#2563EB',
                'secondary_color': '#10B981',
            }
        )
        self.stdout.write(self.style.SUCCESS(f'Tenant Siedlce: {"created" if created else "already exists"}'))

        warsaw, created = Tenant.objects.get_or_create(
            name='Warsaw Runners',
            defaults={
                'primary_color': '#DC2626',
                'secondary_color': '#FBBF24',
            }
        )
        self.stdout.write(self.style.SUCCESS(f'Tenant Warsaw: {"created" if created else "already exists"}'))

        # 2. Create Tenant Admins
        siedlce_admin, created = User.objects.get_or_create(
            username='siedlce_admin',
            defaults={'role': 'TENANT_ADMIN', 'tenant': siedlce},
        )
        siedlce_admin.set_password('siedlce123')
        siedlce_admin.save()

        # Create athletes
        athlete, _ = User.objects.get_or_create(
            username='athlete_01',
            defaults={'role': 'ATHLETE', 'tenant': siedlce},
        )
        if not athlete.has_usable_password():
            athlete.set_password('athlete2026')
            athlete.save()

        athlete_w, _ = User.objects.get_or_create(
            username='athlete_warsaw',
            defaults={'role': 'ATHLETE', 'tenant': warsaw},
        )
        self.stdout.write(self.style.SUCCESS(f'Athlete athlete_warsaw: {"created" if created else "already exists"}'))

        if created:
            Activity.objects.get_or_create(
                user=athlete_w,
                tenant=warsaw,
                type='BIKE',
                start_time=timezone.now(),
                defaults={
                    'distance': 15000,
                    'duration': timedelta(minutes=45),
                    'verification_score': 0.9,
                    'is_verified': True,
                },
            )
            self.stdout.write(self.style.SUCCESS('Created BIKE activity for athlete_warsaw'))

        self.stdout.write(self.style.SUCCESS('Seeding complete.'))
