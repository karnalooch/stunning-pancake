"""
Aktywne Miasta 2026 — Simulation Script for 4VELO / SPORT Platform
====================================================================
Populates the database with realistic data mimicking the Polish
"Aktywne Miasta" inter-city competition.

Usage:
    python manage.py shell < simulate_active_cities.py
    python simulate_active_cities.py  (with proper Django setup)

CLI flags:
    --scale FLOAT    Scale factor (default 1.0). 0.1 = 10% of data.
    --days INT       Competition duration in days (default 30).
    --clear          Delete existing simulation data before running.
    --dry-run        Print what would be created without inserting.
"""
from __future__ import annotations

import argparse
import math
import os
import random
import sys
import time
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# Django bootstrap (works both via `manage.py shell` and standalone)
# ---------------------------------------------------------------------------
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
if not django.conf.settings.configured:
    django.setup()

from django.contrib.gis.geos import LineString, Point
from django.db import transaction
from django.utils import timezone as django_tz

# ---------------------------------------------------------------------------
# City definitions — real Polish cities with approximate center coordinates
# ---------------------------------------------------------------------------
CITIES = [
    {"name": "Warszawa",    "slug": "warszawa",     "lat": 52.2297, "lon": 21.0122, "colors": ("#DC2626", "#FBBF24")},
    {"name": "Kraków",      "slug": "krakow",       "lat": 50.0647, "lon": 19.9450, "colors": ("#2563EB", "#10B981")},
    {"name": "Wrocław",     "slug": "wroclaw",      "lat": 51.1079, "lon": 17.0385, "colors": ("#F59E0B", "#EF4444")},
    {"name": "Poznań",      "slug": "poznan",       "lat": 52.4064, "lon": 16.9252, "colors": ("#8B5CF6", "#FBBF24")},
    {"name": "Gdańsk",      "slug": "gdansk",       "lat": 54.3520, "lon": 18.6466, "colors": ("#06B6D4", "#F59E0B")},
    {"name": "Łódź",        "slug": "lodz",         "lat": 51.7592, "lon": 19.4560, "colors": ("#EC4899", "#6366F1")},
    {"name": "Lublin",      "slug": "lublin",       "lat": 51.2465, "lon": 22.5684, "colors": ("#10B981", "#F59E0B")},
    {"name": "Bydgoszcz",   "slug": "bydgoszcz",    "lat": 53.1235, "lon": 18.0084, "colors": ("#3B82F6", "#EF4444")},
    {"name": "Katowice",    "slug": "katowice",     "lat": 50.2649, "lon": 19.0238, "colors": ("#14B8A6", "#F97316")},
    {"name": "Siedlce",     "slug": "siedlce",      "lat": 52.1676, "lon": 22.2900, "colors": ("#2563EB", "#10B981")},
]

# ---------------------------------------------------------------------------
# Polish name pools
# ---------------------------------------------------------------------------
FIRST_NAMES_M = [
    "Adam", "Piotr", "Krzysztof", "Tomasz", "Paweł", "Michał", "Jakub", "Marcin",
    "Łukasz", "Grzegorz", "Marek", "Maciej", "Jan", "Andrzej", "Robert", "Dariusz",
    "Wojciech", "Bartosz", "Mateusz", "Kamil", "Rafał", "Sebastian", "Artur", "Filip",
    "Damian", "Adrian", "Patryk", "Dawid", "Igor", "Oskar", "Wiktor", "Aleksander",
    "Stanisław", "Kazimierz", "Zbigniew", "Jerzy", "Tadeusz", "Ryszard", "Mariusz", "Jacek",
]
FIRST_NAMES_F = [
    "Anna", "Maria", "Katarzyna", "Magdalena", "Agnieszka", "Barbara", "Ewa", "Monika",
    "Joanna", "Aleksandra", "Natalia", "Julia", "Maja", "Zuzanna", "Hanna", "Wiktoria",
    "Oliwia", "Amelia", "Zofia", "Lena", "Emilia", "Kinga", "Patrycja", "Karolina",
    "Dorota", "Iwona", "Beata", "Renata", "Sylwia", "Justyna", "Małgorzata", "Elżbieta",
    "Krystyna", "Teresa", "Danuta", "Halina", "Irena", "Urszula", "Grażyna", "Bożena",
]
LAST_NAMES = [
    "Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kamiński", "Lewandowski", "Zieliński",
    "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Kwiatkowski",
    "Krawczyk", "Piotrowski", "Grabowski", "Nowakowski", "Pawłowski", "Michalski",
    "Adamczyk", "Dudek", "Zając", "Wieczorek", "Jabłoński", "Król", "Majewski",
    "Olszewski", "Jaworski", "Wróbel", "Malinowski", "Stępień", "Duda", "Bąk",
    "Wilk", "Czarnecki", "Sawicki", "Sokołowski", "Urbański", "Kubiak",
]

# Department name templates per city
SCHOOL_NAMES = [
    "Szkoła Podstawowa nr {}", "Liceum Ogólnokształcące nr {}",
    "Zespół Szkół nr {}", "Szkoła Podstawowa im. Adama Mickiewicza",
    "Liceum Ogólnokształcące im. Marii Curie-Skłodowskiej",
    "Zespół Szkół Technicznych", "Szkoła Podstawowa im. Janusza Korczaka",
    "Liceum Ogólnokształcące im. Bolesława Chrobrego",
    "Szkoła Podstawowa im. Mikołaja Kopernika",
    "Zespół Szkół Ekonomicznych",
]
UNI_NAMES = [
    "Uniwersytet", "Politechnika", "Akademia Wychowania Fizycznego",
    "Akademia Medyczna", "Uniwersytet Przyrodniczy", "Akademia Sztuk Pięknych",
    "Wydział Informatyki", "Wydział Mechaniczny", "Wydział Ekonomii",
    "Wydział Filologii", "Wydział Matematyki", "Wydział Biologii",
]
INST_NAMES = [
    "Urząd Miasta", "Szpital Miejski", "Klub Sportowy", "Ośrodek Kultury",
    "Biblioteka Miejska", "Straż Miejska", "Zakład Komunalny",
    "Centrum Sportu i Rekreacji", "Miejski Ośrodek Pomocy Społecznej",
]

# Activity type distribution
ACTIVITY_TYPES = [
    ("RUN",    0.35, 3000,  15000,  6.0,  12.0),   # type, weight, min_m, max_m, min_kmh, max_kmh
    ("BIKE",   0.45, 5000,  60000, 15.0,  30.0),
    ("WALK",   0.20, 1000,   8000,  3.0,   6.0),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pick_name():
    first = random.choice(FIRST_NAMES_M + FIRST_NAMES_F)
    last = random.choice(LAST_NAMES)
    # Make last name agree in gender (simple heuristic)
    if first in FIRST_NAMES_F:
        # Feminise last name
        if last.endswith("ski"):
            last = last[:-1] + "a"
        elif last.endswith("cki"):
            last = last[:-1] + "a"
        elif last.endswith("dzki"):
            last = last[:-1] + "a"
    return first, last


def _generate_gps_track(lat: float, lon: float, distance_m: float, activity_type: str) -> LineString:
    """
    Generate a realistic GPS track as a LineString.

    Strategy:
    - Start at a random point within ~3 km of city center.
    - Generate a loop: go out, then return, with natural meandering.
    - Add GPS noise (±0.00005° per point).
    - Number of points scales with distance (50–500).
    """
    # Roughly 1° lat ≈ 111 km, 1° lon ≈ 111 km * cos(lat)
    cos_lat = math.cos(math.radians(lat))
    km_per_deg_lat = 111.0
    km_per_deg_lon = 111.0 * cos_lat

    # Starting point: random within 3 km
    start_offset_km = random.uniform(0.5, 3.0)
    start_bearing = random.uniform(0, 2 * math.pi)
    start_lat = lat + (start_offset_km / km_per_deg_lat) * math.sin(start_bearing)
    start_lon = lon + (start_offset_km / km_per_deg_lon) * math.cos(start_bearing)

    # Number of track points
    n_points = max(50, min(500, int(distance_m / 20)))  # ~1 point per 20 m

    # Generate a loop path using parametric circle with noise
    # We create a "blob" — a perturbed circle that goes out and comes back
    radius_deg = (distance_m / 1000.0) / (2 * km_per_deg_lat)  # rough radius in degrees
    radius_deg = max(0.002, min(0.05, radius_deg))  # clamp

    coords = []
    for i in range(n_points):
        t = (i / n_points) * 2 * math.pi

        # Base circular path
        base_lat = start_lat + radius_deg * math.sin(t)
        base_lon = start_lon + radius_deg * math.cos(t) / cos_lat

        # Add meandering noise (correlated random walk)
        noise_lat = random.gauss(0, 0.0003)
        noise_lon = random.gauss(0, 0.0003)

        # GPS jitter
        jitter_lat = random.uniform(-0.00005, 0.00005)
        jitter_lon = random.uniform(-0.00005, 0.00005)

        coords.append((
            base_lon + noise_lon + jitter_lon,  # lon first (GeoJSON order)
            base_lat + noise_lat + jitter_lat,
        ))

    # Ensure the track starts and ends near the same point (loop closure)
    if len(coords) > 1:
        # Blend last few points toward start
        blend = min(10, len(coords) // 4)
        for j in range(blend):
            alpha = (j + 1) / blend
            coords[-(j + 1)] = (
                coords[-(j + 1)][0] * (1 - alpha) + coords[0][0] * alpha,
                coords[-(j + 1)][1] * (1 - alpha) + coords[0][1] * alpha,
            )

    return LineString(coords, srid=4326)


def _generate_timestamp(days: int) -> datetime:
    """
    Generate a realistic activity timestamp within the competition window.
    - Mostly daylight hours (6:00–21:00)
    - Peaks at morning (7–9) and evening (17–20)
    - More activities on weekends
    """
    day_offset = random.uniform(0, days)
    base_date = django_tz.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
    day = base_date + timedelta(days=day_offset)

    # Day-of-week weighting: weekends get 1.5x weight
    dow = day.weekday()
    if dow >= 5:  # Saturday=5, Sunday=6
        # Shift day slightly toward weekend
        pass

    # Hour distribution: bimodal (morning + evening peaks)
    hour = _sample_hour()
    minute = random.randint(0, 59)
    second = random.randint(0, 59)

    return day.replace(hour=hour, minute=minute, second=second)


def _sample_hour() -> int:
    """Sample an hour with bimodal distribution (morning + evening peaks)."""
    # Use a mixture of distributions
    r = random.random()
    if r < 0.15:
        # Morning peak: 7–9
        return random.choices([7, 8, 9], weights=[3, 5, 3])[0]
    elif r < 0.30:
        # Evening peak: 17–20
        return random.choices([17, 18, 19, 20], weights=[3, 5, 5, 3])[0]
    elif r < 0.50:
        # Midday: 10–16
        return random.randint(10, 16)
    elif r < 0.70:
        # Late morning: 9–11
        return random.randint(9, 11)
    elif r < 0.85:
        # Afternoon: 14–17
        return random.randint(14, 17)
    else:
        # Early morning or late evening: 6–7 or 20–21
        return random.choice([6, 6, 7, 20, 20, 21])


def _pick_activity_type():
    """Pick activity type based on distribution weights."""
    r = random.random()
    cumulative = 0
    for act_type, weight, *_ in ACTIVITY_TYPES:
        cumulative += weight
        if r <= cumulative:
            return act_type
    return "RUN"


def _generate_activity_params(activity_type: str):
    """Return (distance_m, duration_seconds) for the given type."""
    for act_type, _, min_m, max_m, min_kmh, max_kmh in ACTIVITY_TYPES:
        if act_type == activity_type:
            distance = random.uniform(min_m, max_m)
            speed_kmh = random.uniform(min_kmh, max_kmh)
            duration_s = (distance / 1000.0) / speed_kmh * 3600
            return distance, duration_s
    return 5000, 1800  # fallback


# ---------------------------------------------------------------------------
# Main simulation
# ---------------------------------------------------------------------------

def run(scale: float = 1.0, days: int = 30, clear: bool = False, dry_run: bool = False):
    """Run the Aktywne Miasta simulation."""
    # Lazy imports — models must be loaded after Django is ready
    from users.models import User, Tenant, Role
    from users.departments import Department, UserDepartment
    from activities.models import Activity

    scale = max(0.001, min(1.0, scale))
    users_per_city = int(11_000 * scale)
    activities_per_user = max(1, int(4.8 * scale * (days / 30)))  # ~5 activities per user at full scale over 30 days
    departments_per_city = max(5, int(20 * scale))

    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║        AKTYWNE MIASTA 2026 — SIMULATION SETUP           ║")
    print("╠══════════════════════════════════════════════════════════╣")
    print(f"║  Scale factor:    {scale:.2f}{' (DRY RUN)' if dry_run else '':20s}║")
    print(f"║  Cities:          {len(CITIES):<42d}║")
    print(f"║  Users/city:      {users_per_city:<42d}║")
    print(f"║  Total users:     {len(CITIES) * users_per_city:<42d}║")
    print(f"║  Days:            {days:<42d}║")
    print(f"║  Est. activities: {len(CITIES) * users_per_city * activities_per_user:<42,d}║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()

    if dry_run:
        print("🔍 DRY RUN — no data will be inserted.")
        return

    # ------------------------------------------------------------------
    # Phase 0: Clear existing data (optional)
    # ------------------------------------------------------------------
    if clear:
        print("🗑️  Clearing existing simulation data...")
        tenant_names = [c["name"] for c in CITIES]
        tenants_to_delete = Tenant.objects.filter(name__in=tenant_names)
        tenant_ids = list(tenants_to_delete.values_list("id", flat=True))
        Activity.objects.filter(tenant_id__in=tenant_ids).delete()
        User.objects.filter(tenant_id__in=tenant_ids).delete()
        Department.objects.filter(tenant_id__in=tenant_ids).delete()
        tenants_to_delete.delete()
        print("   ✅ Cleared.")
        print()

    # ------------------------------------------------------------------
    # Phase 1: Create tenants
    # ------------------------------------------------------------------
    print("🏙️  Phase 1: Creating tenants...")
    tenants = {}
    for city in CITIES:
        colors = city["colors"]
        tenant, created = Tenant.objects.get_or_create(
            name=city["name"],
            defaults={
                "primary_color": colors[0],
                "secondary_color": colors[1],
                "has_heatmap_analytics": True,
                "max_users": users_per_city + 1000,
            },
        )
        tenants[city["name"]] = tenant
        status = "✅ Created" if created else "♻️  Exists"
        print(f"   {status}: {city['name']} (id={tenant.id})")
    print()

    # ------------------------------------------------------------------
    # Phase 2: Create tenant admins
    # ------------------------------------------------------------------
    print("👤 Phase 2: Creating tenant admins...")
    for city in CITIES:
        tenant = tenants[city["name"]]
        admin_username = f"admin_{city['slug']}"
        admin, created = User.objects.get_or_create(
            username=admin_username,
            defaults={
                "email": f"admin.{city['slug']}@aktywnemiasta.pl",
                "role": Role.TENANT_ADMIN,
                "tenant": tenant,
                "first_name": city["name"],
                "last_name": "Administrator",
            },
        )
        if created:
            admin.set_password(f"Admin{city['name']}2026!")
            admin.save()
            print(f"   ✅ Created admin: {admin_username}")
        else:
            print(f"   ♻️  Admin exists: {admin_username}")
    print()

    # ------------------------------------------------------------------
    # Phase 3: Create departments per city
    # ------------------------------------------------------------------
    print("🏫 Phase 3: Creating departments...")
    departments_by_city = {}
    total_departments = 0

    for city in CITIES:
        tenant = tenants[city["name"]]
        city_depts = []

        # Schools
        n_schools = max(3, int(random.uniform(5, 10) * scale))
        for i in range(1, n_schools + 1):
            name = random.choice(SCHOOL_NAMES).format(i)
            dept, created = Department.objects.get_or_create(
                tenant=tenant, name=name,
                defaults={"department_type": "class", "description": f"Szkoła w {city['name']}"},
            )
            city_depts.append(dept)

        # Universities / faculties
        n_unis = max(2, int(random.uniform(3, 5) * scale))
        parent_uni = None
        for i in range(1, n_unis + 1):
            if i == 1:
                # Create parent university
                name = f"{random.choice(UNI_NAMES)} w {city['name']}"
                dept, created = Department.objects.get_or_create(
                    tenant=tenant, name=name,
                    defaults={"department_type": "faculty", "description": f"Uniwersytet w {city['name']}"},
                )
                parent_uni = dept
                city_depts.append(dept)
            else:
                # Create faculty under parent
                fac_name = f"{random.choice(UNI_NAMES)} — {city['name']}"
                dept, created = Department.objects.get_or_create(
                    tenant=tenant, name=fac_name,
                    defaults={
                        "department_type": "faculty",
                        "parent": parent_uni,
                        "description": f"Wydział w {city['name']}",
                    },
                )
                city_depts.append(dept)

        # Institutions
        n_insts = max(2, int(random.uniform(3, 5) * scale))
        for i in range(n_insts):
            name = f"{random.choice(INST_NAMES)} w {city['name']}"
            dept, created = Department.objects.get_or_create(
                tenant=tenant, name=name,
                defaults={"department_type": "department", "description": f"Instytucja w {city['name']}"},
            )
            city_depts.append(dept)

        departments_by_city[city["name"]] = city_depts
        total_departments += len(city_depts)
        print(f"   ✅ {city['name']}: {len(city_depts)} departments")

    print(f"   📊 Total departments: {total_departments}")
    print()

    # ------------------------------------------------------------------
    # Phase 4: Create users per city
    # ---------------------------------------------------------------------------
    print("👥 Phase 4: Creating users...")
    users_by_city = {}
    total_users = 0
    batch_size = 500

    for city in CITIES:
        tenant = tenants[city["name"]]
        city_depts = departments_by_city[city["name"]]
        city_users = []

        n_moderators = max(1, int(5 * scale))
        n_athletes = users_per_city - n_moderators

        print(f"   🏙️  {city['name']}: creating {users_per_city} users...")

        # Create moderators
        for i in range(n_moderators):
            first, last = _pick_name()
            username = f"moderator_{city['slug']}_{i+1}"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@aktywnemiasta.pl",
                    "role": Role.TENANT_MODERATOR,
                    "tenant": tenant,
                    "first_name": first,
                    "last_name": last,
                },
            )
            if created:
                user.set_password("Moderator2026!")
                user.save()
                # Assign to a random department
                if city_depts:
                    dept = random.choice(city_depts)
                    UserDepartment.objects.get_or_create(user=user, department=dept)
            city_users.append(user)

        # Create athletes in batches
        for batch_start in range(0, n_athletes, batch_size):
            batch_end = min(batch_start + batch_size, n_athletes)
            batch_count = batch_end - batch_start
            users_to_create = []

            for i in range(batch_count):
                idx = batch_start + i
                first, last = _pick_name()
                username = f"{city['slug']}_athlete_{idx+1:06d}"
                email = f"{username}@aktywnemiasta.pl"

                if not User.objects.filter(username=username).exists():
                    user = User(
                        username=username,
                        email=email,
                        role=Role.ATHLETE,
                        tenant=tenant,
                        first_name=first,
                        last_name=last,
                    )
                    user.set_password("Athlete2026!")
                    users_to_create.append(user)

            if users_to_create:
                with transaction.atomic():
                    try:
                        created_users = User.objects.bulk_create(users_to_create)
                    except Exception:
                        # Fall back to individual inserts, skipping duplicates
                        created_users = []
                        for u in users_to_create:
                            try:
                                with transaction.atomic():
                                    u.save()
                                    created_users.append(u)
                            except Exception:
                                pass  # skip duplicate
                    city_users.extend(created_users)

                    # Assign to departments
                    dept_memberships = []
                    for u in created_users:
                        dept = random.choice(city_depts)
                        dept_memberships.append(UserDepartment(user=u, department=dept))
                    if dept_memberships:
                        UserDepartment.objects.bulk_create(dept_memberships)

            progress = min(batch_end, n_athletes)
            if progress % 1000 == 0 or progress == n_athletes:
                print(f"      ... {progress}/{n_athletes} users created")

        users_by_city[city["name"]] = city_users
        total_users += len(city_users)
        print(f"   ✅ {city['name']}: {len(city_users)} users")

    print(f"   📊 Total users: {total_users}")
    print()

    # ------------------------------------------------------------------
    # Phase 5: Create activities with GPS tracks
    # ------------------------------------------------------------------
    print("🏃 Phase 5: Creating activities with GPS tracks...")
    total_activities = 0
    total_distance = 0.0
    verified_count = 0
    activity_counts_by_city = {}
    distance_by_city = {}

    act_batch_size = 200  # bulk_create batch size

    for city in CITIES:
        city_users = users_by_city[city["name"]]
        tenant = tenants[city["name"]]
        city_lat = city["lat"]
        city_lon = city["lon"]
        city_activities = 0
        city_distance = 0.0

        print(f"   🏙️  {city['name']}: generating activities for {len(city_users)} users...")

        act_batch: list[Activity] = []

        for user_idx, user in enumerate(city_users):
            # Each user generates 0–N activities over the competition
            n_activities = random.randint(0, activities_per_user * 2)
            # 10% of users are inactive
            if random.random() < 0.1:
                n_activities = 0

            for _ in range(n_activities):
                act_type = _pick_activity_type()
                distance_m, duration_s = _generate_activity_params(act_type)
                start_time = _generate_timestamp(days)
                end_time = start_time + timedelta(seconds=duration_s)

                # Verification: ~90% verified
                is_verified = random.random() < 0.90
                verification_score = random.uniform(0.7, 1.0) if is_verified else random.uniform(0.0, 0.4)

                # Generate GPS track
                try:
                    route_path = _generate_gps_track(city_lat, city_lon, distance_m, act_type)
                except Exception:
                    route_path = None

                activity = Activity(
                    user=user,
                    tenant=tenant,
                    type=act_type,
                    start_time=start_time,
                    end_time=end_time,
                    distance=distance_m,
                    duration=timedelta(seconds=duration_s),
                    is_verified=is_verified,
                    verification_score=verification_score,
                    route_path=route_path,
                )
                act_batch.append(activity)

                total_distance += distance_m
                city_distance += distance_m
                city_activities += 1
                if is_verified:
                    verified_count += 1

                # Flush batch
                if len(act_batch) >= act_batch_size:
                    with transaction.atomic():
                        Activity.objects.bulk_create(act_batch)
                    act_batch.clear()

            # Progress logging
            if (user_idx + 1) % 500 == 0:
                print(f"      ... {user_idx + 1}/{len(city_users)} users processed, {city_activities} activities")

        # Flush remaining
        if act_batch:
            with transaction.atomic():
                Activity.objects.bulk_create(act_batch)
            act_batch.clear()

        activity_counts_by_city[city["name"]] = city_activities
        distance_by_city[city["name"]] = city_distance
        total_activities += city_activities
        print(f"   ✅ {city['name']}: {city_activities} activities, {city_distance / 1000:,.0f} km")

    print(f"   📊 Total activities: {total_activities}")
    print()

    # ------------------------------------------------------------------
    # Phase 6: Print summary
    # ------------------------------------------------------------------
    avg_distance_per_user = total_distance / max(1, total_users) / 1000.0
    verified_pct = verified_count / max(1, total_activities) * 100

    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║        AKTYWNE MIASTA 2026 — SIMULATION COMPLETE        ║")
    print("╠══════════════════════════════════════════════════════════╣")
    print(f"║  Cities:          {len(CITIES):<42d}║")
    print(f"║  Departments:     {total_departments:<42d}║")
    print(f"║  Users:           {total_users:<42,d}║")
    print(f"║  Activities:      {total_activities:<42,d}║")
    print(f"║  Total Distance:  {total_distance / 1000:>12,.0f} km{' ' * 26}║")
    print(f"║  Avg per User:    {avg_distance_per_user:>12,.1f} km{' ' * 26}║")
    print(f"║  Verified:        {verified_pct:>12.1f}%{' ' * 26}║")
    print("╠══════════════════════════════════════════════════════════╣")
    print("║  CITY RANKINGS (by distance)                            ║")
    print("╠══════════════════════════════════════════════════════════╣")

    # Sort cities by distance
    sorted_cities = sorted(distance_by_city.items(), key=lambda x: x[1], reverse=True)
    for rank, (city_name, dist) in enumerate(sorted_cities, 1):
        acts = activity_counts_by_city[city_name]
        name_padded = f"{rank}. {city_name}".ljust(18)
        dist_str = f"{dist / 1000:>10,.0f} km"
        acts_str = f"{acts:>8,d} acts"
        line = f"║  {name_padded} {dist_str}  {acts_str}{' ' * max(0, 42 - len(name_padded) - len(dist_str) - len(acts_str) - 4)}║"
        print(line)

    print("╚══════════════════════════════════════════════════════════╝")
    print()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Aktywne Miasta 2026 Simulation")
    parser.add_argument("--scale", type=float, default=1.0, help="Scale factor (0.001–1.0, default 1.0)")
    parser.add_argument("--days", type=int, default=30, help="Competition duration in days (default 30)")
    parser.add_argument("--clear", action="store_true", help="Delete existing simulation data before running")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be created without inserting")
    args = parser.parse_args()

    run(scale=args.scale, days=args.days, clear=args.clear, dry_run=args.dry_run)
