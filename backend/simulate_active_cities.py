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
_ATHLETE_PASSWORD_HASH: str | None = None


def _athlete_password_hash() -> str:
    """One bcrypt hash for all simulator athletes — avoids 10k+ set_password() calls."""
    global _ATHLETE_PASSWORD_HASH
    if _ATHLETE_PASSWORD_HASH is None:
        from django.contrib.auth.hashers import make_password
        _ATHLETE_PASSWORD_HASH = make_password('Athlete2026!')
    return _ATHLETE_PASSWORD_HASH


def _plan_cities_for_target(total_users: int, num_cities_hint: int | None = None):
    """
    Pick city count so Celery chord stays bounded (≤20 tasks) with adaptive users/city.
    Uses activities.scale_config.compute_batch_scaling (10k → ~10×1k, 300k → ~10×30k).
    """
    total_users = int(total_users)
    try:
        from activities.scale_config import compute_batch_scaling
        plan = compute_batch_scaling(total_users, max_cities_available=len(CITIES))
        n = plan['num_cities']
        users_per_city = plan['users_per_city']
    except Exception:
        if total_users >= 5_000:
            n = min(len(CITIES), max(5, min(10, total_users // 800)))
        else:
            limit = num_cities_hint if num_cities_hint is not None else 3
            n = random.randint(max(3, min(limit, len(CITIES))), len(CITIES))
        users_per_city = max(50, total_users // n)

    if total_users < 5_000 and num_cities_hint is not None:
        n = min(len(CITIES), max(3, num_cities_hint))

    selected = random.sample(CITIES, min(n, len(CITIES)))
    if total_users >= 5_000:
        users_per_city = max(50, math.ceil(total_users / len(selected)))
    return selected, users_per_city


def _batch_sizes_for_target(total_users: int | None) -> tuple[int, int]:
    """(bulk_batch_size, pg_batch_size) — adaptive when total_users is set."""
    if not total_users:
        try:
            from activities.scale_config import USER_BULK_BATCH_SIZE, USER_BULK_PG_BATCH_SIZE
            return USER_BULK_BATCH_SIZE, USER_BULK_PG_BATCH_SIZE
        except Exception:
            return 500, 500
    try:
        from activities.scale_config import compute_batch_scaling
        plan = compute_batch_scaling(int(total_users), max_cities_available=len(CITIES))
        return plan['user_bulk_batch_size'], plan['user_bulk_pg_batch_size']
    except Exception:
        return 2500, 500


def _batch_user_insert_flags(skip_activities: bool) -> tuple[bool, bool]:
    """(skip_dept, fast_insert) — only enabled for skip_activities batch paths."""
    if not skip_activities:
        return False, False
    try:
        from activities.scale_config import BATCH_FAST_INSERT, SKIP_DEPT_ON_BATCH
        skip_dept = SKIP_DEPT_ON_BATCH
        fast_insert = BATCH_FAST_INSERT and skip_dept
    except Exception:
        skip_dept, fast_insert = True, True
    return skip_dept, fast_insert


def _bulk_create_athletes(
    city: dict,
    tenant,
    n_athletes: int,
    city_depts: list,
    batch_size: int,
    pg_batch_size: int,
    *,
    on_batch_created=None,
    skip_dept: bool = False,
    fast_insert: bool = False,
) -> int:
    """Insert athletes via bulk_create; returns count actually linked in DB."""
    from users.models import User
    from users.departments import UserDepartment

    pwd = _athlete_password_hash()
    total = 0
    use_fast = fast_insert and skip_dept
    pg_chunk = max(50, int(pg_batch_size))

    def _bulk_create_user_chunks(users, **kwargs):
        for i in range(0, len(users), pg_chunk):
            User.objects.bulk_create(users[i:i + pg_chunk], batch_size=pg_chunk, **kwargs)

    for batch_start in range(0, n_athletes, batch_size):
        batch_end = min(batch_start + batch_size, n_athletes)
        batch_count = batch_end - batch_start
        users_to_create = []

        for i in range(batch_count):
            idx = batch_start + i
            first, last = _pick_name()
            username = f"{city['slug']}_athlete_{idx+1:06d}"
            users_to_create.append(User(
                username=username,
                email=f'{username}@aktywnemiasta.pl',
                role='ATHLETE',
                tenant=tenant,
                first_name=first,
                last_name=last,
                password=pwd,
            ))

        if not users_to_create:
            continue

        usernames = [u.username for u in users_to_create]
        with transaction.atomic():
            if use_fast:
                inserted = False
                try:
                    _bulk_create_user_chunks(users_to_create, ignore_conflicts=False)
                    inserted = True
                except TypeError:
                    _bulk_create_user_chunks(users_to_create)
                    inserted = True
                except Exception:
                    try:
                        _bulk_create_user_chunks(users_to_create, ignore_conflicts=True)
                        inserted = True
                    except TypeError:
                        _bulk_create_user_chunks(users_to_create)
                        inserted = True
                    except Exception:
                        for u in users_to_create:
                            try:
                                u.save()
                            except Exception:
                                pass
                n_saved = len(users_to_create) if inserted else 0
            else:
                try:
                    _bulk_create_user_chunks(users_to_create, ignore_conflicts=True)
                except TypeError:
                    _bulk_create_user_chunks(users_to_create)
                except Exception:
                    for u in users_to_create:
                        try:
                            u.save()
                        except Exception:
                            pass

                user_ids = list(
                    User.objects.filter(
                        username__in=usernames, tenant=tenant,
                    ).values_list('id', flat=True)
                )
                n_saved = len(user_ids)
                if user_ids and city_depts and not skip_dept:
                    dept_ids = [d.pk for d in city_depts]
                    memberships = [
                        UserDepartment(
                            user_id=uid,
                            department_id=dept_ids[i % len(dept_ids)],
                        )
                        for i, uid in enumerate(user_ids)
                    ]
                    try:
                        UserDepartment.objects.bulk_create(
                            memberships, batch_size=pg_batch_size, ignore_conflicts=True,
                        )
                    except TypeError:
                        UserDepartment.objects.bulk_create(memberships, batch_size=pg_batch_size)

        total += n_saved
        if on_batch_created and n_saved:
            on_batch_created(n_saved)

    return total


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

CITIES_BY_SLUG = {c['slug']: c for c in CITIES}
CITIES_BY_NAME = {c['name']: c for c in CITIES}


def resolve_city_for_user(user) -> dict:
    """
    Map an athlete to a CITIES entry: tenant name, username prefix, then stable hash.
    Used by live sim so rides start near the athlete's city, not Warsaw by default.
    """
    if user is None:
        return CITIES[0]
    tenant = getattr(user, 'tenant', None)
    if tenant is not None:
        name = (getattr(tenant, 'name', None) or '').strip()
        if name in CITIES_BY_NAME:
            return CITIES_BY_NAME[name]
    username = (getattr(user, 'username', None) or '').lower()
    for city in CITIES:
        if username.startswith(f"{city['slug']}_"):
            return city
    pk = getattr(user, 'pk', None) or getattr(user, 'id', None)
    if pk is not None:
        return CITIES[int(pk) % len(CITIES)]
    return CITIES[0]


def run(
    scale: float = 1.0,
    days: int = 30,
    clear: bool = False,
    dry_run: bool = False,
    skip_activities: bool = False,
    skip_user_creation: bool = False,
    total_users: int = None,
    num_cities: int = None,
    progress_callback=None,
):
    """Run the Aktywne Miasta simulation.

    progress_callback(**kwargs): optional; receives current_phase, progress_pct,
    users_created, activities_created for Redis/UI progress bars.
    """

    def report(phase: str, pct: float, **extra):
        if progress_callback:
            progress_callback(
                current_phase=phase,
                progress_pct=round(min(100.0, max(0.0, pct)), 1),
                **extra,
            )
    # Lazy imports — models must be loaded after Django is ready
    from users.models import User, Tenant
    from users.departments import Department, UserDepartment
    from activities.models import Activity

    # If total_users is specified, use it directly across random cities
    if total_users:
        total_users = int(total_users)
        selected_cities, users_per_city = _plan_cities_for_target(total_users, num_cities)
        num_cities = len(selected_cities)
        scale = 0.01  # minimal scale for department calculations
    else:
        selected_cities = CITIES
        scale = max(0.001, min(1.0, scale))
        users_per_city = int(11_000 * scale)
    activities_per_user = max(1, int(4.8 * scale * (days / 30)))  # ~5 at full scale
    departments_per_city = max(5, int(20 * scale))

    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║        AKTYWNE MIASTA 2026 — SIMULATION SETUP           ║")
    print("╠══════════════════════════════════════════════════════════╣")
    total_u = len(selected_cities) * users_per_city
    print(f"║  Cities:          {len(selected_cities):<42d}║")
    print(f"║  Users/city:      {users_per_city:<42d}║")
    print(f"║  Total users:     {total_u:<42d}║")
    print(f"║  Days:            {days:<42d}║")
    print(f"║  Est. activities: {total_u * activities_per_user:<42,d}║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()

    if dry_run:
        print("🔍 DRY RUN — no data will be inserted.")
        return

    report('initializing', 1, users_created=0, activities_created=0)

    # ------------------------------------------------------------------
    # Phase 0: Clear existing data (optional)
    # ------------------------------------------------------------------
    if clear:
        report('clearing', 3)
        print("🗑️  Clearing all existing simulation data...")
        Activity.objects.all().delete()
        User.objects.filter(is_superuser=False, is_staff=False).delete()
        Department.objects.all().delete()
        Tenant.objects.all().delete()
        print("   ✅ Cleared.")
        print()
        report('clearing', 8)

    # ------------------------------------------------------------------
    # Phase 1: Create tenants
    # ------------------------------------------------------------------
    report('creating_tenants', 10)
    print("🏙️  Phase 1: Creating tenants...")
    tenants = {}
    for city in selected_cities:
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
    report('creating_tenants', 12)

    # ------------------------------------------------------------------
    # Phase 2: Create tenant admins
    # ------------------------------------------------------------------
    report('creating_admins', 14)
    print("👤 Phase 2: Creating tenant admins...")
    for city in selected_cities:
        tenant = tenants[city["name"]]
        admin_username = f"admin_{city['slug']}"
        admin, created = User.objects.get_or_create(
            username=admin_username,
            defaults={
                "email": f"admin.{city['slug']}@aktywnemiasta.pl",
                "role": "TENANT_ADMIN",
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
    report('creating_admins', 16)

    # ------------------------------------------------------------------
    # Phase 3: Create departments per city
    # ------------------------------------------------------------------
    report('creating_departments', 18)
    print("🏫 Phase 3: Creating departments...")
    departments_by_city = {}
    total_departments = 0

    for city in selected_cities:
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
    report('creating_departments', 20, users_created=0, activities_created=0)

    if skip_user_creation:
        return {
            'city_slugs': [c['slug'] for c in selected_cities],
            'users_per_city': users_per_city,
            'scale': scale,
            'activities_per_user': activities_per_user,
            'days': days,
            'total_u': total_u,
        }

    # ------------------------------------------------------------------
    # Phase 4: Create users per city
    # ---------------------------------------------------------------------------
    report('creating_users', 22)
    print("👥 Phase 4: Creating users...")
    users_by_city = {}
    total_users_created = 0
    batch_size, pg_batch_size = _batch_sizes_for_target(total_users)
    target_user_count = total_u

    for city_index, city in enumerate(selected_cities):
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
                    "role": "TENANT_MODERATOR",
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

        athletes_created = 0

        def _on_batch(n_saved: int):
            nonlocal athletes_created
            athletes_created += n_saved
            users_so_far = sum(len(v) for v in users_by_city.values()) + len(city_users) + athletes_created
            city_frac = athletes_created / max(1, n_athletes)
            overall = (city_index + city_frac) / max(1, len(selected_cities))
            pct = 22 + 63 * overall
            report('creating_users', pct, users_created=users_so_far, activities_created=0)

        skip_dept, fast_insert = _batch_user_insert_flags(skip_activities)
        n_athletes_created = _bulk_create_athletes(
            city, tenant, n_athletes, city_depts, batch_size, pg_batch_size,
            on_batch_created=_on_batch,
            skip_dept=skip_dept,
            fast_insert=fast_insert,
        )
        if not skip_activities and n_athletes_created:
            city_users.extend(
                User.objects.filter(
                    tenant=tenant, role='ATHLETE',
                    username__startswith=f"{city['slug']}_athlete_",
                ).only('id', 'username', 'tenant_id')
            )
        users_by_city[city["name"]] = city_users
        total_users_created += len(city_users)
        print(f"   ✅ {city['name']}: {len(city_users)} users")
        report(
            'creating_users',
            22 + 63 * ((city_index + 1) / max(1, len(selected_cities))),
            users_created=total_users_created,
            activities_created=0,
        )

    print(f"   📊 Total users: {total_users_created}")
    print()
    report('creating_users', 85, users_created=total_users_created, activities_created=0)

    # ------------------------------------------------------------------
    # Phase 5: Create activities with GPS tracks (skip if requested)
    # ------------------------------------------------------------------
    if skip_activities:
        print("⏭️  Phase 5: Skipping activity generation.")
        report('complete', 100, users_created=total_users_created, activities_created=0)
        return  # <= exits the function after user creation, skipping activity generation entirely

    report('creating_activities', 86)
    print("🏃 Phase 5: Creating activities with GPS tracks...")
    total_activities = 0
    total_distance = 0.0
    verified_count = 0
    activity_counts_by_city = {}
    distance_by_city = {}

    act_batch_size = 50  # bulk_create batch size (limit to 50 for SQLite 999 SQL variables limit)

    for act_city_index, city in enumerate(selected_cities):
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

                if not user.pk:
                    continue
                activity = Activity(
                    user_id=user.pk,
                    tenant_id=tenant.pk,
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
                        Activity.objects.bulk_create(act_batch, batch_size=50)
                    act_batch.clear()

            # Progress logging
            if (user_idx + 1) % 500 == 0:
                print(f"      ... {user_idx + 1}/{len(city_users)} users processed, {city_activities} activities")
                city_frac = (user_idx + 1) / max(1, len(city_users))
                overall = (act_city_index + city_frac) / max(1, len(selected_cities))
                pct = 86 + 13 * overall
                report(
                    'creating_activities',
                    pct,
                    users_created=total_users_created,
                    activities_created=total_activities,
                )

        # Flush remaining
        if act_batch:
            with transaction.atomic():
                Activity.objects.bulk_create(act_batch, batch_size=50)
            act_batch.clear()

        activity_counts_by_city[city["name"]] = city_activities
        distance_by_city[city["name"]] = city_distance
        total_activities += city_activities
        print(f"   ✅ {city['name']}: {city_activities} activities, {city_distance / 1000:,.0f} km")
        report(
            'creating_activities',
            86 + 13 * ((act_city_index + 1) / max(1, len(selected_cities))),
            users_created=total_users_created,
            activities_created=total_activities,
        )

    print(f"   📊 Total activities: {total_activities}")
    report('complete', 99, users_created=total_users_created, activities_created=total_activities)
    print()
    # end of skip_activities block
    # ------------------------------------------------------------------
    avg_distance_per_user = total_distance / max(1, total_users_created) / 1000.0
    verified_pct = verified_count / max(1, total_activities) * 100

    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║        AKTYWNE MIASTA 2026 — SIMULATION COMPLETE        ║")
    print("╠══════════════════════════════════════════════════════════╣")
    print(f"║  Cities:          {len(CITIES):<42d}║")
    print(f"║  Departments:     {total_departments:<42d}║")
    print(f"║  Users:           {total_users_created:<42,d}║")
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


def create_users_for_city(
    city_slug: str,
    users_per_city: int,
    scale: float,
    *,
    city_index: int = 0,
    total_cities: int = 1,
    total_target_users: int | None = None,
    progress_callback=None,
) -> int:
    """
    Phase 4 for a single city — intended for parallel Celery workers.
    Returns number of user rows linked to the city (moderators + athletes).
    """
    from users.models import User, Tenant
    from users.departments import Department, UserDepartment
    from activities import simulator_state as sim

    city = CITIES_BY_SLUG.get(city_slug)
    if not city:
        raise ValueError(f'Unknown city slug: {city_slug}')

    batch_size, pg_batch_size = _batch_sizes_for_target(total_target_users)

    tenant = Tenant.objects.get(name=city['name'])
    city_depts = list(Department.objects.filter(tenant=tenant, is_active=True))
    moderator_count = 0

    def report(phase: str, pct: float, **extra):
        if progress_callback:
            progress_callback(
                current_phase=phase,
                progress_pct=round(min(100.0, max(0.0, pct)), 1),
                **extra,
            )

    n_moderators = max(1, int(5 * scale))
    n_athletes = users_per_city - n_moderators

    print(f"   🏙️  {city['name']}: creating {users_per_city} users (worker)...")

    for i in range(n_moderators):
        first, last = _pick_name()
        username = f"moderator_{city['slug']}_{i+1}"
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': f'{username}@aktywnemiasta.pl',
                'role': 'TENANT_MODERATOR',
                'tenant': tenant,
                'first_name': first,
                'last_name': last,
            },
        )
        if created:
            user.set_password('Moderator2026!')
            user.save()
            if city_depts:
                dept = random.choice(city_depts)
                UserDepartment.objects.get_or_create(user=user, department=dept)
            moderator_count += 1
            sim.increment_batch_users_created_throttled(1)

    athletes_done = 0

    def _on_parallel_batch(n_saved: int):
        nonlocal athletes_done
        athletes_done += n_saved
        users_so_far = sim.increment_batch_users_created_throttled(n_saved)
        city_frac = athletes_done / max(1, n_athletes)
        overall = (city_index + city_frac) / max(1, total_cities)
        pct = 22 + 63 * overall
        if progress_callback:
            sim.set_batch_state_throttled(
                current_phase='creating_users',
                progress_pct=round(min(100.0, max(0.0, pct)), 1),
                users_created=users_so_far,
                activities_created=0,
            )
        report('creating_users', pct, users_created=users_so_far, activities_created=0)

    skip_dept, fast_insert = _batch_user_insert_flags(skip_activities=True)
    n_athletes_created = _bulk_create_athletes(
        city, tenant, n_athletes, city_depts, batch_size, pg_batch_size,
        on_batch_created=_on_parallel_batch,
        skip_dept=skip_dept,
        fast_insert=fast_insert,
    )
    sim.flush_batch_users_progress()
    created_count = moderator_count + n_athletes_created
    print(f"   ✅ {city['name']}: {created_count} users (parallel worker)")
    return created_count


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
