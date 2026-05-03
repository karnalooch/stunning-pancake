import os
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point
from django.utils import timezone
from datetime import timedelta
from users.models import User, Tenant, Role
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
        admin, created = User.objects.get_or_create(
            username='siedlce_admin',
            defaults={'role': Role.TENANT_ADMIN, 'tenant': siedlce},
        )
        if created:
            admin.set_password('siedlce123')
            admin.save()
        self.stdout.write(self.style.SUCCESS(f'Tenant admin siedlce_admin: {"created" if created else "already exists"}'))

        # 3. Create POIs & Vouchers
        coffee_poi, created = POI.objects.get_or_create(
            name='Eco Coffee Siedlce',
            tenant=siedlce,
            defaults={'location': Point(22.2906, 52.1672)},
        )
        self.stdout.write(self.style.SUCCESS(f'POI Eco Coffee: {"created" if created else "already exists"}'))

        voucher, created = Voucher.objects.get_or_create(
            poi=coffee_poi,
            code='COFFEE-20',
            defaults={
                'discount_value': '20%',
                'expiry_date': timezone.now() + timedelta(days=30),
            },
        )
        self.stdout.write(self.style.SUCCESS(f'Voucher COFFEE-20: {"created" if created else "already exists"}'))

        # 4. Create Mock Athletes & Activities
        athlete, created = User.objects.get_or_create(
            username='athlete_01',
            defaults={'role': Role.ATHLETE, 'tenant': siedlce},
        )
        self.stdout.write(self.style.SUCCESS(f'Athlete athlete_01: {"created" if created else "already exists"}'))

        if created:
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
                        'is_verified': True,
                    },
                )
            self.stdout.write(self.style.SUCCESS('Created 5 mock RUN activities for athlete_01'))

        athlete_w, created = User.objects.get_or_create(
            username='athlete_warsaw',
            defaults={'role': Role.ATHLETE, 'tenant': warsaw},
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
