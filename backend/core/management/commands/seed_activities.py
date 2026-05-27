import random
import math
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point, LineString
from django.utils import timezone
from users.models import User, Tenant
from activities.models import Activity, POI, Voucher


def generate_loop_gps(center_lon, center_lat, radius_km=1.5, jitter=0.0003, num_points=50):
    """Generate a realistic running/cycling loop around a center point."""
    coords = []
    earth_radius_km = 6371.0
    for i in range(num_points):
        angle = (2 * math.pi * i) / num_points
        # Add some variation to the radius for realism
        r = radius_km + random.uniform(-0.2, 0.2)
        # Convert polar to lat/lon offset
        dlat = (r * math.cos(angle)) / earth_radius_km * (180 / math.pi)
        dlon = (r * math.sin(angle)) / (earth_radius_km * math.cos(math.radians(center_lat))) * (180 / math.pi)
        lat = center_lat + dlat + random.uniform(-jitter, jitter)
        lon = center_lon + dlon + random.uniform(-jitter, jitter)
        coords.append((lon, lat))
    # Close the loop
    coords.append(coords[0])
    return coords


def generate_out_and_back_gps(start_lon, start_lat, bearing_deg, distance_km=3.0, jitter=0.0002, num_points=40):
    """Generate an out-and-back GPS track."""
    coords = []
    earth_radius_km = 6371.0
    bearing_rad = math.radians(bearing_deg)
    
    for i in range(num_points):
        fraction = i / (num_points - 1)
        if fraction <= 0.5:
            d = distance_km * (fraction * 2)
        else:
            d = distance_km * ((1 - fraction) * 2)
        
        dlat = (d * math.cos(bearing_rad)) / earth_radius_km * (180 / math.pi)
        dlon = (d * math.sin(bearing_rad)) / (earth_radius_km * math.cos(math.radians(start_lat))) * (180 / math.pi)
        
        if fraction > 0.5:
            dlat = -dlat
            dlon = -dlon
        
        lat = start_lat + dlat + random.uniform(-jitter, jitter)
        lon = start_lon + dlon + random.uniform(-jitter, jitter)
        coords.append((lon, lat))
    
    return coords


SIEDLCE_CENTER = (22.2906, 52.1672)
WARSAW_CENTER = (21.0122, 52.2297)
SIEDLCE_PARK = (22.2880, 52.1640)
SIEDLCE_LAKE = (22.2930, 52.1700)


class Command(BaseCommand):
    help = 'Seeds 50+ demo activities with realistic GPS data, varied verification scores, and POIs'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing seed activities before seeding')

    def handle(self, *args, **options):
        self.stdout.write('=' * 60)
        self.stdout.write(self.style.WARNING('SPORT Platform — Seed 50+ Demo Activities'))
        self.stdout.write('=' * 60)

        if options['clear']:
            deleted, _ = Activity.objects.filter(
                user__username__startswith='athlete_'
            ).delete()
            self.stdout.write(f'Cleared {deleted} existing seed activities')

        # ── 1. Ensure tenants exist ──
        siedlce, _ = Tenant.objects.get_or_create(
            name='Siedlce City',
            defaults={'primary_color': '#2563EB', 'secondary_color': '#10B981'}
        )
        warsaw, _ = Tenant.objects.get_or_create(
            name='Warsaw Runners',
            defaults={'primary_color': '#DC2626', 'secondary_color': '#FBBF24'}
        )
        self.stdout.write(f'Tenants: {siedlce.name}, {warsaw.name}')

        # ── 2. Ensure athletes exist with real names ──
        athlete_configs = [
            ('athlete_001', 'Adam', 'Kowalski', 'adam.kowalski@example.com', siedlce),
            ('athlete_002', 'Ewa', 'Nowak', 'ewa.nowak@example.com', siedlce),
            ('athlete_003', 'Piotr', 'Wisniewski', 'piotr.wisniewski@example.com', siedlce),
            ('athlete_004', 'Anna', 'Wojcik', 'anna.wojcik@example.com', siedlce),
            ('athlete_005', 'Marek', 'Kaminski', 'marek.kaminski@example.com', siedlce),
            ('athlete_006', 'Katarzyna', 'Lewandowski', 'katarzyna.lewandowski@example.com', siedlce),
            ('athlete_007', 'Tomasz', 'Zielinski', 'tomasz.zielinski@example.com', warsaw),
            ('athlete_008', 'Magdalena', 'Szymanski', 'magdalena.szymanski@example.com', warsaw),
            ('athlete_009', 'Krzysztof', 'Wozniak', 'krzysztof.wozniak@example.com', warsaw),
            ('athlete_010', 'Zofia', 'Dabrowski', 'zofia.dabrowski@example.com', warsaw),
        ]

        athletes = []
        for username, first_name, last_name, email, tenant in athlete_configs:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'role': 'ATHLETE',
                    'tenant': tenant,
                    'first_name': first_name,
                    'last_name': last_name,
                    'email': email,
                }
            )
            if created:
                user.set_password('athlete_password_2026')
                user.save()
                self.stdout.write(f'  Created: {username} ({first_name} {last_name}) @ {tenant.name}')
            athletes.append(user)

        # ── 3. Remove existing activities for these users (to avoid duplicates) ──
        existing = Activity.objects.filter(user__username__startswith='athlete_0').count()
        self.stdout.write(f'Existing seed activities: {existing}')
        if existing > 0 and not options['clear']:
            self.stdout.write(self.style.WARNING(f'{existing} activities already exist. Use --clear to regenerate.'))

        # ── 4. Create additional POIs ──
        poi_configs = [
            ('Eco Coffee Siedlce', SIEDLCE_CENTER, 'COFFEE', 'Specialty coffee with athlete discounts', siedlce),
            ('Bike Zone Siedlce', (22.2850, 52.1680), 'BIKE', 'Bike repair and accessories', siedlce),
            ('FitMarket Siedlce', (22.2920, 52.1655), 'SHOP', 'Healthy food and supplements', siedlce),
            ('Warsaw Runner Hub', (21.0150, 52.2320), 'COFFEE', 'Running community café', warsaw),
            ('CyclePro Warsaw', (21.0080, 52.2280), 'BIKE', 'Premium bike service', warsaw),
            ('UrbanFit Warsaw', (21.0200, 52.2350), 'SHOP', 'Sports nutrition store', warsaw),
        ]

        created_pois = []
        for name, loc, cat, desc, tenant in poi_configs:
            poi, created = POI.objects.get_or_create(
                name=name,
                tenant=tenant,
                defaults={
                    'location': Point(loc[0], loc[1]),
                    'category': cat,
                    'description': desc,
                }
            )
            if created:
                self.stdout.write(f'  POI: {name} ({cat})')
            created_pois.append(poi)

        # ── 5. Create vouchers for POIs ──
        voucher_codes = {
            'Eco Coffee Siedlce': ['COFFEE-20', 'COFFEE-FREE', 'ESPRESSO-10'],
            'Bike Zone Siedlce': ['BIKE-FIX-15', 'PUMP-FREE'],
            'FitMarket Siedlce': ['FIT-10', 'PROTEIN-25'],
            'Warsaw Runner Hub': ['WRH-CAKE', 'WRH-DRINK'],
            'CyclePro Warsaw': ['CYCLE-SAVE-20'],
            'UrbanFit Warsaw': ['URBAN-10'],
        }

        voucher_count = 0
        for poi in created_pois:
            codes = voucher_codes.get(poi.name, [f'{poi.name[:4].upper()}-10'])
            for code in codes:
                _, created = Voucher.objects.get_or_create(
                    code=code,
                    defaults={
                        'poi': poi,
                        'discount_value': f'{random.randint(10, 30)}%',
                        'expiry_date': timezone.now() + timedelta(days=random.randint(14, 60)),
                    }
                )
                if created:
                    voucher_count += 1
        self.stdout.write(f'  Created {voucher_count} vouchers')

        # ── 6. Generate 50+ activities ──
        ACTIVITY_TYPES = ['RUN', 'BIKE', 'WALK']
        activity_weights = [0.5, 0.25, 0.25]  # More running than other types
        now = timezone.now()
        
        # Predefined track generators for variety
        loop_generators = [
            lambda: generate_loop_gps(*SIEDLCE_PARK, radius_km=0.8, num_points=45),
            lambda: generate_loop_gps(*SIEDLCE_LAKE, radius_km=1.2, num_points=55),
            lambda: generate_loop_gps(*SIEDLCE_CENTER, radius_km=2.0, num_points=60),
            lambda: generate_loop_gps(*WARSAW_CENTER, radius_km=1.8, num_points=50),
            lambda: generate_out_and_back_gps(SIEDLCE_CENTER[0], SIEDLCE_CENTER[1], 45, 3.5),
            lambda: generate_out_and_back_gps(WARSAW_CENTER[0], WARSAW_CENTER[1], 90, 4.0),
            lambda: generate_out_and_back_gps(SIEDLCE_PARK[0], SIEDLCE_PARK[1], 180, 2.5),
        ]

        activities_created = 0
        TARGET = 55

        # Distribute activities across athletes with varying counts
        activity_counts = []
        for athlete in athletes:
            count = random.randint(3, 8)
            activity_counts.append((athlete, count))

        # Ensure we hit at least 50
        total_planned = sum(c for _, c in activity_counts)
        if total_planned < TARGET:
            activity_counts.append((athletes[0], TARGET - total_planned))

        for athlete, count in activity_counts:
            tenant = athlete.tenant
            for i in range(count):
                days_ago = random.randint(0, 30)
                hours_ago = random.randint(6, 20)
                start_time = now - timedelta(days=days_ago, hours=hours_ago)

                activity_type = random.choices(ACTIVITY_TYPES, weights=activity_weights, k=1)[0]
                
                # Distance depends on type
                if activity_type == 'RUN':
                    distance = random.randint(3000, 12000)
                elif activity_type == 'BIKE':
                    distance = random.randint(8000, 35000)
                else:  # WALK
                    distance = random.randint(1000, 8000)

                # Duration depends on type and distance
                if activity_type == 'RUN':
                    pace_ms = random.uniform(2.5, 5.0)  # 12-6 km/h
                elif activity_type == 'BIKE':
                    pace_ms = random.uniform(5.0, 10.0)  # 18-36 km/h
                else:
                    pace_ms = random.uniform(1.0, 1.8)   # 3.6-6.5 km/h
                duration_seconds = distance / pace_ms
                duration = timedelta(seconds=int(duration_seconds))

                # Verification: 60% verified, 25% unverified/suspicious, 15% rejected
                rand = random.random()
                if rand < 0.60:
                    is_verified = True
                    verification_score = round(random.uniform(0.75, 1.0), 2)
                elif rand < 0.85:
                    is_verified = False
                    verification_score = round(random.uniform(0.3, 0.7), 2)
                else:
                    is_verified = False
                    verification_score = round(random.uniform(0.0, 0.25), 2)

                # Generate GPS route
                gen = random.choice(loop_generators)
                try:
                    coords = gen()
                    route_path = LineString(coords, srid=4326)
                except Exception:
                    route_path = None

                activity = Activity.objects.create(
                    user=athlete,
                    tenant=tenant,
                    type=activity_type,
                    start_time=start_time,
                    end_time=start_time + duration,
                    distance=distance,
                    duration=duration,
                    is_verified=is_verified,
                    verification_score=verification_score,
                    route_path=route_path,
                )
                activities_created += 1

        self.stdout.write(self.style.SUCCESS(f'Created {activities_created} demo activities'))
        
        # ── 7. Summary ──
        total_users = User.objects.count()
        total_act = Activity.objects.count()
        total_verified = Activity.objects.filter(is_verified=True).count()
        total_unverified = Activity.objects.filter(is_verified=False).count()

        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write(self.style.SUCCESS('SEEDING COMPLETE'))
        self.stdout.write(f'  Total users: {total_users}')
        self.stdout.write(f'  Total activities: {total_act}')
        self.stdout.write(f'    Verified: {total_verified}')
        self.stdout.write(f'    Unverified (anomalies): {total_unverified}')
        self.stdout.write(f'  Tenants: {Tenant.objects.count()}')
        self.stdout.write(f'  POIs: {POI.objects.count()}')
        self.stdout.write(f'  Vouchers: {Voucher.objects.count()}')
        self.stdout.write('=' * 60)
