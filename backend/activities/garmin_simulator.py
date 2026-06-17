"""
Garmin Simulator — Live-first ride simulation around Siedlce.
Architecture: schedule rides → live tick chain (1 tick/sec) → finish GPX → upload.

Live map visibility: each tick pushes position to Redis via TelemetryService.
GPX: 1-second density matching Garmin Edge 530 Smart Recording (1:1).
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import random
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

from django.utils import timezone

from core.redis_cluster import get_redis

logger = logging.getLogger(__name__)

SIEDLCE_CENTER = (52.1659, 22.2757)

# ── Redis keys ──────────────────────────────────────────────────
GARMIN_BATCH_STATE_KEY = "{sim}:garmin_batch:state"
GARMIN_BATCH_LOG_KEY = "{sim}:garmin_batch:log"
GARMIN_BATCH_LOCK_KEY = "{sim}:garmin_batch:lock"
GARMIN_BATCH_SUMMARY_KEY = "{sim}:garmin_batch:summary"
GARMIN_BATCH_LOCK_TTL = 7200  # 2 hours — spans scheduling window

GARMIN_LIVE_PREFIX = "{sim}:garmin_live"  # :{ride_id}:state, :{ride_id}:points, :{ride_id}:lock


# ── Data classes ─────────────────────────────────────────────────
@dataclass
class MotionProfile:
    speed_kmh: float
    hr_base: int
    hr_max: int
    cadence_base: int
    cadence_max: int
    temperature_c: float
    elevation_base_m: float = 152.0
    elevation_variation: float = 8.0


@dataclass
class RidePlan:
    user_index: int
    date: date
    start_time: datetime
    distance_km: float
    speed_kmh: float
    start_lat: float
    start_lon: float
    motion: MotionProfile = field(default=None)  # type: ignore[assignment]

    def __post_init__(self):
        if self.motion is None:
            self.motion = _generate_motion_profile(self.speed_kmh, self.start_time)

    def to_dict(self) -> dict:
        return {
            "user_index": self.user_index,
            "date": self.date.isoformat(),
            "start_time": self.start_time.isoformat(),
            "distance_km": self.distance_km,
            "speed_kmh": self.speed_kmh,
            "start_lat": self.start_lat,
            "start_lon": self.start_lon,
            "motion": {
                "speed_kmh": self.motion.speed_kmh,
                "hr_base": self.motion.hr_base,
                "hr_max": self.motion.hr_max,
                "cadence_base": self.motion.cadence_base,
                "cadence_max": self.motion.cadence_max,
                "temperature_c": self.motion.temperature_c,
                "elevation_base_m": self.motion.elevation_base_m,
                "elevation_variation": self.motion.elevation_variation,
            },
        }

    @classmethod
    def from_dict(cls, d: dict) -> RidePlan:
        m = d["motion"]
        return cls(
            user_index=d["user_index"],
            date=date.fromisoformat(d["date"]),
            start_time=datetime.fromisoformat(d["start_time"]),
            distance_km=d["distance_km"],
            speed_kmh=d["speed_kmh"],
            start_lat=d["start_lat"],
            start_lon=d["start_lon"],
            motion=MotionProfile(
                speed_kmh=m["speed_kmh"],
                hr_base=m["hr_base"],
                hr_max=m["hr_max"],
                cadence_base=m["cadence_base"],
                cadence_max=m["cadence_max"],
                temperature_c=m["temperature_c"],
                elevation_base_m=m["elevation_base_m"],
                elevation_variation=m["elevation_variation"],
            ),
        )


@dataclass
class ScheduleConfig:
    user_count: int = 10
    weekday_rides: int = 3
    weekday_distance_min: float = 60.0
    weekday_distance_max: float = 80.0
    weekend_distance_min: float = 90.0
    weekend_distance_max: float = 120.0
    speed_min: float = 20.0
    speed_max: float = 31.0
    weekday_start_h_min: int = 14
    weekday_start_h_max: int = 18
    weekend_start_h_min: int = 8
    weekend_start_h_max: int = 14
    start_radius_km: float = 5.0


def schedule_config_from_dict(d: dict | None) -> ScheduleConfig:
    if not d:
        return ScheduleConfig()
    return ScheduleConfig(
        user_count=int(d.get("user_count", 10)),
        weekday_rides=int(d.get("weekday_rides", 3)),
        weekday_distance_min=float(d.get("weekday_distance_min", 60)),
        weekday_distance_max=float(d.get("weekday_distance_max", 80)),
        weekend_distance_min=float(d.get("weekend_distance_min", 90)),
        weekend_distance_max=float(d.get("weekend_distance_max", 120)),
        speed_min=float(d.get("speed_min", 20)),
        speed_max=float(d.get("speed_max", 31)),
        weekday_start_h_min=int(d.get("weekday_start_h_min", 14)),
        weekday_start_h_max=int(d.get("weekday_start_h_max", 18)),
        weekend_start_h_min=int(d.get("weekend_start_h_min", 8)),
        weekend_start_h_max=int(d.get("weekend_start_h_max", 14)),
        start_radius_km=float(d.get("start_radius_km", 5)),
    )


# ── Redis state helpers ──────────────────────────────────────────
def _redis_int(val, default: int = 0) -> int:
    if val is None:
        return default
    try:
        return int(float(str(val).strip()))
    except (TypeError, ValueError):
        return default


def _redis_float(val, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        return float(str(val).strip())
    except (TypeError, ValueError):
        return default


def get_garmin_batch_state() -> dict:
    r = get_redis()
    raw = r.hgetall(GARMIN_BATCH_STATE_KEY)
    if not raw:
        return {
            "running": False,
            "progress_pct": 0.0,
            "phase": "idle",
            "total_rides": 0,
            "rides_scheduled": 0,
            "rides_active": 0,
            "rides_done": 0,
            "error": None,
        }
    state: dict[str, Any] = {
        k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v
        for k, v in raw.items()
    }
    state["running"] = state.get("running", "false").lower() == "true"
    state["progress_pct"] = _redis_float(state.get("progress_pct"), 0.0)
    state["total_rides"] = _redis_int(state.get("total_rides"))
    state["rides_scheduled"] = _redis_int(state.get("rides_scheduled"))
    state["rides_active"] = _redis_int(state.get("rides_active"))
    state["rides_done"] = _redis_int(state.get("rides_done"))
    state["phase"] = state.get("phase", "idle")
    state["error"] = state.get("error") or None
    return state


def set_garmin_batch_state(**fields) -> None:
    r = get_redis()
    mapping = {}
    for k, v in fields.items():
        if isinstance(v, bool):
            mapping[k] = "true" if v else "false"
        elif v is None:
            mapping[k] = ""
        else:
            mapping[k] = str(v)
    r.hset(GARMIN_BATCH_STATE_KEY, mapping=mapping)


def garmin_batch_log(message: str) -> None:
    ts = timezone.now().strftime("%H:%M:%S")
    r = get_redis()
    r.rpush(GARMIN_BATCH_LOG_KEY, f"{ts}|{message}")
    r.ltrim(GARMIN_BATCH_LOG_KEY, -200, -1)


def get_garmin_batch_logs() -> list[tuple[str, str]]:
    r = get_redis()
    raw = r.lrange(GARMIN_BATCH_LOG_KEY, 0, -1)
    entries: list[tuple[str, str]] = []
    for item in raw or []:
        text = item.decode() if isinstance(item, bytes) else str(item)
        parts = text.split("|", 1)
        if len(parts) == 2:
            entries.append((parts[0], parts[1]))
        else:
            entries.append(("", text))
    return entries


def acquire_garmin_batch_lock(task_id: str) -> bool:
    r = get_redis()
    acquired = r.set(GARMIN_BATCH_LOCK_KEY, task_id, nx=True, ex=GARMIN_BATCH_LOCK_TTL)
    return bool(acquired)


def release_garmin_batch_lock() -> None:
    r = get_redis()
    r.delete(GARMIN_BATCH_LOCK_KEY)


def is_garmin_batch_lock_held() -> bool:
    r = get_redis()
    return bool(r.exists(GARMIN_BATCH_LOCK_KEY))


def clear_garmin_batch_state() -> None:
    r = get_redis()
    keys_to_delete = [GARMIN_BATCH_STATE_KEY, GARMIN_BATCH_LOG_KEY, GARMIN_BATCH_LOCK_KEY]
    r.delete(*keys_to_delete)


def store_garmin_summary(users_data: list[dict]) -> None:
    r = get_redis()
    r.set(GARMIN_BATCH_SUMMARY_KEY, json.dumps(users_data))


def clear_garmin_summary() -> None:
    r = get_redis()
    r.delete(GARMIN_BATCH_SUMMARY_KEY)


def get_garmin_summary() -> list[dict]:
    r = get_redis()
    raw = r.get(GARMIN_BATCH_SUMMARY_KEY)
    if not raw:
        return []
    try:
        return json.loads(raw.decode() if isinstance(raw, bytes) else raw)
    except Exception:
        return []


# ── Polish name generator ────────────────────────────────────────
_PL_FIRST_NAMES_MALE = [
    "Piotr", "Krzysztof", "Andrzej", "Tomasz", "Marcin", "Michał", "Jakub",
    "Mateusz", "Łukasz", "Rafał", "Grzegorz", "Maciej", "Dawid", "Adam",
    "Bartosz", "Damian", "Karol", "Szymon", "Paweł", "Jan", "Artur",
    "Kamil", "Daniel", "Sebastian", "Mariusz", "Robert", "Wojciech",
    "Radosław", "Przemysław", "Jarosław", "Kacper", "Kuba",
]
_PL_FIRST_NAMES_FEMALE = [
    "Anna", "Katarzyna", "Magdalena", "Agnieszka", "Małgorzata", "Joanna",
    "Marta", "Natalia", "Aleksandra", "Monika", "Dorota", "Ewa", "Karolina",
    "Paulina", "Justyna", "Patrycja", "Barbara", "Kinga", "Izabela",
    "Weronika", "Kamila", "Martyna", "Sylwia", "Agata", "Klaudia",
]
_PL_LAST_NAMES = [
    "Nowak", "Kowalski", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński",
    "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski",
    "Kozłowski", "Jankowski", "Mazur", "Kwiatkowski", "Krawczyk",
    "Piotrowski", "Grabowski", "Nowakowski", "Pawłowski", "Michalski",
    "Nowicki", "Adamczyk", "Dudek", "Zając", "Wieczorek", "Jabłoński",
    "Król", "Majewski", "Olszewski", "Stępień", "Jaworski", "Malinowski",
    "Sadowski", "Walczak", "Baran", "Czarnecki", "Adamski", "Sikora",
    "Górski", "Borkowski", "Rutkowski", "Ostrowski", "Szewczyk",
    "Tomaszewski", "Pietrzak", "Marciniak", "Wróblewski", "Zalewski",
    "Jakubowski", "Jasiński", "Bąk", "Wilk", "Duda", "Sikorski",
    "Chmielewski", "Przybylski", "Kaźmierczak", "Włodarczyk",
]


def generate_polish_name(index: int = 0) -> tuple[str, str, str]:
    first = random.choice(_PL_FIRST_NAMES_MALE + _PL_FIRST_NAMES_FEMALE)
    last = random.choice(_PL_LAST_NAMES)
    display_name = f"{first} {last}"
    username_slug = f"{first.lower()}_{last.lower()}"
    return first, last, display_name


# ── Per-ride Redis helpers ───────────────────────────────────────
def _ride_state_key(ride_id: str) -> str:
    return f"{GARMIN_LIVE_PREFIX}:{ride_id}:state"


def _ride_points_key(ride_id: str) -> str:
    return f"{GARMIN_LIVE_PREFIX}:{ride_id}:points"


def get_ride_state(ride_id: str) -> dict | None:
    r = get_redis()
    raw = r.hgetall(_ride_state_key(ride_id))
    if not raw:
        return None
    state = {}
    for k, v in (raw or {}).items():
        key = k.decode() if isinstance(k, bytes) else k
        val = v.decode() if isinstance(v, bytes) else v
        state[key] = val
    state["tick"] = _redis_int(state.get("tick"))
    state["duration_s"] = _redis_int(state.get("duration_s"))
    state["user_id"] = _redis_int(state.get("user_id"))
    return state


def set_ride_state(ride_id: str, **fields) -> None:
    r = get_redis()
    mapping = {}
    for k, v in fields.items():
        if isinstance(v, bool):
            mapping[k] = "true" if v else "false"
        elif v is None:
            mapping[k] = ""
        else:
            mapping[k] = str(v)
    r.hset(_ride_state_key(ride_id), mapping=mapping)
    duration_s = fields.get("duration_s", 0)
    r.expire(_ride_state_key(ride_id), int(duration_s or 14400) + 120)


def get_ride_points(ride_id: str) -> list[dict]:
    r = get_redis()
    raw = r.lrange(_ride_points_key(ride_id), 0, -1)
    points = []
    for item in raw or []:
        text = item.decode() if isinstance(item, bytes) else str(item)
        try:
            points.append(json.loads(text))
        except Exception:
            pass
    return points


def push_ride_point(ride_id: str, point: dict) -> None:
    r = get_redis()
    r.rpush(_ride_points_key(ride_id), json.dumps(point))


def remove_ride_keys(ride_id: str) -> None:
    r = get_redis()
    r.delete(_ride_state_key(ride_id), _ride_points_key(ride_id))


# ── Motion profile generation ────────────────────────────────────
def _generate_motion_profile(speed_kmh: float, start_time: datetime) -> MotionProfile:
    hour = start_time.hour
    if 6 <= hour < 10:
        temp_range = (12, 20)
    elif 10 <= hour < 14:
        temp_range = (18, 26)
    elif 14 <= hour < 19:
        temp_range = (20, 28)
    else:
        temp_range = (15, 24)
    temperature = round(random.uniform(*temp_range), 1)

    intensity = max(0.6, min(1.0, (speed_kmh - 20) / 15.0))
    hr_base = int(115 + intensity * 35 + random.randint(-5, 5))
    hr_max = int(hr_base + 20 + intensity * 15 + random.randint(-3, 3))

    cad_base = int(72 + intensity * 12 + random.randint(-3, 3))
    cad_max = int(cad_base + 8 + random.randint(0, 5))

    elev_var = 5.0 + random.uniform(0, 12)

    return MotionProfile(
        speed_kmh=speed_kmh,
        hr_base=hr_base,
        hr_max=hr_max,
        cadence_base=cad_base,
        cadence_max=cad_max,
        temperature_c=temperature,
        elevation_base_m=152.0,
        elevation_variation=elev_var,
    )


# ── Schedule generation ──────────────────────────────────────────
def generate_schedules(config: ScheduleConfig, start_date: date | None = None) -> list[RidePlan]:
    if start_date is None:
        start_date = date.today()

    monday = start_date - timedelta(days=start_date.weekday())
    plans: list[RidePlan] = []

    for user_idx in range(config.user_count):
        start_lat, start_lon = _jitter_point_km(
            SIEDLCE_CENTER[0], SIEDLCE_CENTER[1], config.start_radius_km
        )
        weekdays = list(range(0, 5))
        chosen_weekdays = sorted(random.sample(weekdays, min(config.weekday_rides, 5)))

        for wd in chosen_weekdays:
            ride_date = monday + timedelta(days=wd)
            hour = random.randint(config.weekday_start_h_min, config.weekday_start_h_max - 1)
            minute = random.randint(0, 59)
            start_dt = datetime(ride_date.year, ride_date.month, ride_date.day, hour, minute)
            distance = round(random.uniform(config.weekday_distance_min, config.weekday_distance_max), 1)
            speed = round(random.uniform(config.speed_min, config.speed_max), 1)
            plans.append(RidePlan(
                user_index=user_idx,
                date=ride_date,
                start_time=start_dt,
                distance_km=distance,
                speed_kmh=speed,
                start_lat=start_lat,
                start_lon=start_lon,
            ))

        weekend_day = random.choice([5, 6])
        ride_date = monday + timedelta(days=weekend_day)
        hour = random.randint(config.weekend_start_h_min, config.weekend_start_h_max - 1)
        minute = random.randint(0, 59)
        start_dt = datetime(ride_date.year, ride_date.month, ride_date.day, hour, minute)
        distance = round(random.uniform(config.weekend_distance_min, config.weekend_distance_max), 1)
        speed = round(random.uniform(config.speed_min, config.speed_max), 1)
        plans.append(RidePlan(
            user_index=user_idx,
            date=ride_date,
            start_time=start_dt,
            distance_km=distance,
            speed_kmh=speed,
            start_lat=start_lat,
            start_lon=start_lon,
        ))

    plans.sort(key=lambda p: (p.start_time, p.user_index))
    return plans


def _jitter_point_km(lat: float, lon: float, radius_km: float) -> tuple[float, float]:
    if radius_km <= 0:
        return lat, lon
    r = radius_km * math.sqrt(random.random())
    theta = random.uniform(0, 2 * math.pi)
    dlat = (r / 111.0) * math.cos(theta)
    cos_lat = math.cos(math.radians(lat)) or 1e-6
    dlon = (r / (111.0 * cos_lat)) * math.sin(theta)
    return lat + dlat, lon + dlon


# ── Route generation ─────────────────────────────────────────────
def generate_route(
    start_lat: float,
    start_lon: float,
    distance_km: float,
    activity_type: str = "BIKE",
) -> tuple[list[tuple[float, float]], str]:
    try:
        from activities.services import BRouterService
        from activities.simulator_route_waypoints import _generate_grid_waypoints

        distance_m = distance_km * 1000.0
        leg_km = min(6.0, max(0.5, distance_km * 0.08))
        bearing = random.uniform(0, 2 * math.pi)
        end_lat = start_lat + (leg_km / 111.0) * math.cos(bearing)
        end_lon = start_lon + (leg_km / (111.0 * math.cos(math.radians(start_lat)) + 1e-6)) * math.sin(bearing)

        coords = [[start_lon, start_lat], [end_lon, end_lat]]
        result = BRouterService.validate_track(activity_type, coords)

        if result.get("success"):
            waypoints = result.get("coordinates")
            if waypoints and len(waypoints) >= 2:
                return waypoints, "road"

        grid = _generate_grid_waypoints(start_lat, start_lon)
        return grid, "grid"
    except Exception as exc:
        logger.warning("Route generation failed: %s", exc)
        try:
            from activities.simulator_route_waypoints import _generate_grid_waypoints
            grid = _generate_grid_waypoints(start_lat, start_lon)
            return grid, "grid"
        except Exception:
            return _synthetic_loop(start_lat, start_lon, distance_km), "synthetic"


def _synthetic_loop(
    start_lat: float, start_lon: float, distance_km: float
) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = [(start_lat, start_lon)]
    radius_deg = distance_km / 111.0 * 0.5
    steps = 12
    for i in range(1, steps + 1):
        angle = 2 * math.pi * i / steps
        dlat = radius_deg * math.cos(angle) * (0.5 + 0.5 * random.random())
        dlon = radius_deg * math.sin(angle) * (0.5 + 0.5 * random.random())
        points.append((start_lat + dlat, start_lon + dlon))
    return points


# ── Interpolation helpers ────────────────────────────────────────
def _interpolate_position_on_waypoints(
    waypoints: list[tuple[float, float]],
    progress: float,
) -> tuple[float, float, float]:
    if not waypoints or len(waypoints) < 2:
        pt = waypoints[0] if waypoints else (52.1659, 22.2757)
        return pt[0], pt[1], 0.0

    seg_lengths = []
    for i in range(len(waypoints) - 1):
        seg_lengths.append(_haversine_m(
            waypoints[i][0], waypoints[i][1],
            waypoints[i + 1][0], waypoints[i + 1][1],
        ))
    total = sum(seg_lengths)
    if total <= 0:
        return waypoints[0][0], waypoints[0][1], 0.0

    target = progress * total
    walked = 0.0
    for i, seg_len in enumerate(seg_lengths):
        if walked + seg_len >= target or i == len(seg_lengths) - 1:
            frac = (target - walked) / seg_len if seg_len > 0 else 0.0
            frac = max(0.0, min(1.0, frac))
            a_lat, a_lon = waypoints[i]
            b_lat, b_lon = waypoints[i + 1]
            speed_ms = 0.0
            if seg_len > 0:
                speed_ms = seg_len / 1.0  # segment was 1s apart conceptually
            return (
                a_lat + (b_lat - a_lat) * frac,
                a_lon + (b_lon - a_lon) * frac,
                speed_ms,
            )
        walked += seg_len

    return waypoints[-1][0], waypoints[-1][1], 0.0


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    rlat1, rlon1, rlat2, rlon2 = map(math.radians, (lat1, lon1, lat2, lon2))
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371000.0 * math.asin(math.sqrt(a))


def _interpolate_hr(progress: float, motion: MotionProfile) -> int:
    wave = math.sin(progress * math.pi * 3.5) * 0.5 + math.sin(progress * math.pi * 7.3) * 0.3
    val = motion.hr_base + (motion.hr_max - motion.hr_base) * (0.3 + 0.7 * abs(wave))
    val += random.randint(-2, 2)
    return max(60, min(210, int(val)))


def _interpolate_cadence(progress: float, motion: MotionProfile) -> int:
    wave = math.sin(progress * math.pi * 4.1) * 0.4
    val = motion.cadence_base + (motion.cadence_max - motion.cadence_base) * (0.4 + 0.6 * abs(wave))
    val += random.randint(-2, 2)
    return max(40, min(120, int(val)))


def _interpolate_elevation(progress: float, motion: MotionProfile) -> float:
    wave = math.sin(progress * math.pi * 2.5) + math.sin(progress * math.pi * 5.7) * 0.5
    val = motion.elevation_base_m + wave * motion.elevation_variation
    val += random.uniform(-0.5, 0.5)
    return val


def _ride_name(ride_plan: RidePlan) -> str:
    hour = ride_plan.start_time.hour
    if 5 <= hour < 10:
        period = "Morning"
    elif 10 <= hour < 14:
        period = "Late Morning"
    elif 14 <= hour < 18:
        period = "Afternoon"
    else:
        period = "Evening"
    return f"{period} Ride"


# ── GPX generation — 1:1 Garmin Edge 530 ────────────────────────
def generate_gpx_edge530(
    waypoints: list[tuple[float, float]],
    ride_plan: RidePlan,
) -> str:
    import xml.etree.ElementTree as ET
    from xml.dom import minidom

    gpx_ns = "http://www.topografix.com/GPX/1/1"
    gpxtpx_ns = "http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
    gpxx_ns = "http://www.garmin.com/xmlschemas/GpxExtensions/v3"

    ET.register_namespace("", gpx_ns)
    ET.register_namespace("gpxtpx", gpxtpx_ns)
    ET.register_namespace("gpxx", gpxx_ns)

    root = ET.Element(f"{{{gpx_ns}}}gpx", attrib={
        "version": "1.1",
        "creator": "Garmin Edge 530",
    })

    ride_name = _ride_name(ride_plan)
    meta = ET.SubElement(root, f"{{{gpx_ns}}}metadata")
    ET.SubElement(meta, f"{{{gpx_ns}}}name").text = ride_name
    ET.SubElement(meta, f"{{{gpx_ns}}}time").text = ride_plan.start_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    link = ET.SubElement(meta, f"{{{gpx_ns}}}link", attrib={"href": "https://connect.garmin.com"})
    ET.SubElement(link, f"{{{gpx_ns}}}text").text = "Garmin Connect"

    trk = ET.SubElement(root, f"{{{gpx_ns}}}trk")
    ET.SubElement(trk, f"{{{gpx_ns}}}name").text = ride_name
    ET.SubElement(trk, f"{{{gpx_ns}}}type").text = "cycling"
    trkseg = ET.SubElement(trk, f"{{{gpx_ns}}}trkseg")

    total_distance_m = ride_plan.distance_km * 1000.0
    motion = ride_plan.motion
    duration_s = int((ride_plan.distance_km / ride_plan.speed_kmh) * 3600)

    for tick in range(duration_s + 1):
        progress = tick / max(1, duration_s)
        lat, lon, _ = _interpolate_position_on_waypoints(waypoints, progress)
        pt_time = ride_plan.start_time + timedelta(seconds=tick)

        hr_val = _interpolate_hr(progress, motion)
        cad_val = _interpolate_cadence(progress, motion)
        ele_val = _interpolate_elevation(progress, motion)

        trkpt = ET.SubElement(trkseg, f"{{{gpx_ns}}}trkpt", attrib={
            "lat": f"{lat:.6f}",
            "lon": f"{lon:.6f}",
        })
        ET.SubElement(trkpt, f"{{{gpx_ns}}}ele").text = str(round(ele_val, 1))
        ET.SubElement(trkpt, f"{{{gpx_ns}}}time").text = pt_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        extensions = ET.SubElement(trkpt, f"{{{gpx_ns}}}extensions")
        tpx = ET.SubElement(extensions, f"{{{gpxtpx_ns}}}TrackPointExtension")
        ET.SubElement(tpx, f"{{{gpxtpx_ns}}}hr").text = str(hr_val)
        ET.SubElement(tpx, f"{{{gpxtpx_ns}}}cad").text = str(cad_val)

        tx = ET.SubElement(extensions, f"{{{gpxx_ns}}}TrackExtension")
        ET.SubElement(tx, f"{{{gpxx_ns}}}atemp").text = str(int(motion.temperature_c))

    rough = ET.tostring(root, encoding="unicode")
    return minidom.parseString(rough).toprettyxml(indent="  ", encoding=None).strip()


def generate_gpx_from_live_points(
    points: list[dict],
    ride_plan: RidePlan,
) -> str:
    import xml.etree.ElementTree as ET
    from xml.dom import minidom

    gpx_ns = "http://www.topografix.com/GPX/1/1"
    gpxtpx_ns = "http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
    gpxx_ns = "http://www.garmin.com/xmlschemas/GpxExtensions/v3"

    ET.register_namespace("", gpx_ns)
    ET.register_namespace("gpxtpx", gpxtpx_ns)
    ET.register_namespace("gpxx", gpxx_ns)

    root = ET.Element(f"{{{gpx_ns}}}gpx", attrib={
        "version": "1.1",
        "creator": "Garmin Edge 530",
    })

    ride_name = _ride_name(ride_plan)
    meta = ET.SubElement(root, f"{{{gpx_ns}}}metadata")
    ET.SubElement(meta, f"{{{gpx_ns}}}name").text = ride_name
    ET.SubElement(meta, f"{{{gpx_ns}}}time").text = ride_plan.start_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    link = ET.SubElement(meta, f"{{{gpx_ns}}}link", attrib={"href": "https://connect.garmin.com"})
    ET.SubElement(link, f"{{{gpx_ns}}}text").text = "Garmin Connect"

    trk = ET.SubElement(root, f"{{{gpx_ns}}}trk")
    ET.SubElement(trk, f"{{{gpx_ns}}}name").text = ride_name
    ET.SubElement(trk, f"{{{gpx_ns}}}type").text = "cycling"
    trkseg = ET.SubElement(trk, f"{{{gpx_ns}}}trkseg")

    for pt in points:
        lat = float(pt["lat"])
        lon = float(pt["lon"])
        ele = float(pt.get("ele", 152.0))
        hr_val = int(pt.get("hr", 120))
        cad_val = int(pt.get("cad", 80))
        atemp = int(pt.get("atemp", 22))
        pt_time_str = pt.get("time", "")
        if pt_time_str:
            try:
                pt_time = datetime.fromisoformat(pt_time_str).strftime("%Y-%m-%dT%H:%M:%SZ")
            except Exception:
                pt_time = ride_plan.start_time.strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            pt_time = ride_plan.start_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        trkpt = ET.SubElement(trkseg, f"{{{gpx_ns}}}trkpt", attrib={
            "lat": f"{lat:.6f}",
            "lon": f"{lon:.6f}",
        })
        ET.SubElement(trkpt, f"{{{gpx_ns}}}ele").text = str(round(ele, 1))
        ET.SubElement(trkpt, f"{{{gpx_ns}}}time").text = pt_time

        extensions = ET.SubElement(trkpt, f"{{{gpx_ns}}}extensions")
        tpx = ET.SubElement(extensions, f"{{{gpxtpx_ns}}}TrackPointExtension")
        ET.SubElement(tpx, f"{{{gpxtpx_ns}}}hr").text = str(hr_val)
        ET.SubElement(tpx, f"{{{gpxtpx_ns}}}cad").text = str(cad_val)

        tx = ET.SubElement(extensions, f"{{{gpxx_ns}}}TrackExtension")
        ET.SubElement(tx, f"{{{gpxx_ns}}}atemp").text = str(atemp)

    rough = ET.tostring(root, encoding="unicode")
    return minidom.parseString(rough).toprettyxml(indent="  ", encoding=None).strip()


# ── NEW: Schedule rides (replaces run_batch) ─────────────────────
def schedule_rides(
    credentials: list[dict[str, str]],
    config: ScheduleConfig,
    task_id: str = "",
    user_names: list[dict[str, str]] | None = None,
) -> dict:
    if not acquire_garmin_batch_lock(task_id or "manual"):
        return {"status": "error", "message": "Another Garmin batch is already running"}

    try:
        set_garmin_batch_state(
            running=True, phase="creating_users", progress_pct=0,
            rides_scheduled=0, rides_active=0, rides_done=0,
        )
        garmin_batch_log("Starting Garmin live simulation schedule")

        garmin_batch_log(f"Creating {config.user_count} users...")
        users = _create_sim_users(credentials, config.user_count, user_names)
        garmin_batch_log(f"Created {len(users)} users")

        garmin_batch_log("Generating ride schedules...")
        set_garmin_batch_state(phase="scheduling")
        plans = generate_schedules(config)
        total_rides = len(plans)
        set_garmin_batch_state(total_rides=total_rides)
        garmin_batch_log(f"Generated {total_rides} rides for {config.user_count} athletes")

        set_garmin_batch_state(phase="dispatching", progress_pct=5)
        dispatched = 0
        for plan in plans:
            user = users[plan.user_index]
            ride_id = _make_ride_id(user.id, plan)
            duration_s = int((plan.distance_km / plan.speed_kmh) * 3600)

            set_ride_state(
                ride_id,
                user_id=user.id,
                status="PENDING",
                duration_s=duration_s,
                tick=0,
                plan_json=json.dumps(plan.to_dict()),
            )

            from activities.garmin_simulator_tasks import run_garmin_live_tick
            run_garmin_live_tick.apply_async(
                args=[ride_id, 0, duration_s],
                eta=plan.start_time,
            )

            dispatched += 1
            garmin_batch_log(
                f"Scheduled user {plan.user_index + 1}: {plan.date} "
                f"{plan.distance_km}km @ {plan.speed_kmh}km/h "
                f"start {plan.start_time.strftime('%H:%M')} ({duration_s}s)"
            )

        set_garmin_batch_state(
            phase="scheduled", rides_scheduled=dispatched,
            progress_pct=10,
        )
        garmin_batch_log(
            f"All {dispatched} rides scheduled. First ride at {plans[0].start_time.strftime('%H:%M')}, "
            f"last at {plans[-1].start_time.strftime('%H:%M')}"
        )

        release_garmin_batch_lock()
        return {"status": "scheduled", "total_rides": dispatched}

    except Exception as exc:
        logger.exception("Failed to schedule Garmin rides")
        garmin_batch_log(f"FATAL: {exc}")
        set_garmin_batch_state(running=False, error=str(exc)[:500], phase="error")
        release_garmin_batch_lock()
        return {"status": "error", "message": str(exc)}


def _make_ride_id(user_id: int, plan: RidePlan) -> str:
    return f"{user_id}_{plan.date.isoformat()}_{plan.start_time.strftime('%H%M')}"


# ── NEW: Live tick (replaces _process_single_ride) ───────────────
def run_live_tick(ride_id: str, tick: int, duration_s: int) -> dict:
    r = get_redis()

    state = get_ride_state(ride_id)
    if not state:
        return {"status": "error", "message": "no ride state"}

    plan_dict = json.loads(state.get("plan_json", "{}"))
    if not plan_dict:
        return {"status": "error", "message": "no plan in state"}

    plan = RidePlan.from_dict(plan_dict)
    motion = plan.motion
    user_id = state["user_id"]
    speed_ms = plan.speed_kmh / 3.6

    if tick == 0:
        set_ride_state(ride_id, status="ACTIVE", tick=0)
        set_garmin_batch_state(phase="riding")
        incr_active_rides(1)

        waypoints, source = generate_route(
            plan.start_lat, plan.start_lon, plan.distance_km, "BIKE"
        )
        waypoints_json = json.dumps({"waypoints": waypoints, "source": source})
        r.hset(_ride_state_key(ride_id), "waypoints_json", waypoints_json)
        garmin_batch_log(
            f"Ride {ride_id}: ACTIVE — {plan.distance_km}km @ {plan.speed_kmh}km/h "
            f"(route: {source})"
        )

    raw_wp = r.hget(_ride_state_key(ride_id), "waypoints_json")
    waypoints: list[tuple[float, float]] = []

    if raw_wp:
        wp_data = json.loads(raw_wp.decode() if isinstance(raw_wp, bytes) else raw_wp)
        waypoints = [(lat, lon) for lat, lon in wp_data["waypoints"]]

    if not waypoints:
        waypoints = [(plan.start_lat, plan.start_lon)]

    progress = tick / max(1, duration_s)
    lat, lon, _ = _interpolate_position_on_waypoints(waypoints, progress)
    hr_val = _interpolate_hr(progress, motion)
    cad_val = _interpolate_cadence(progress, motion)
    ele_val = _interpolate_elevation(progress, motion)

    device_id = f"garmin_sim_{user_id}"

    try:
        from activities.services import TelemetryService
        TelemetryService.push_simulator_position(
            device_id=device_id,
            lat=lat,
            lon=lon,
            speed=plan.speed_kmh if progress < 0.99 else 0.0,
            course=0,
            name=f"SimUser{user_id}",
            device_type="bike",
        )
    except Exception as exc:
        if tick == 0 or tick % 60 == 0:
            garmin_batch_log(f"WARNING: telemetry push failed for {ride_id}: {exc}")

    point_data = {
        "tick": tick,
        "lat": lat,
        "lon": lon,
        "ele": round(ele_val, 1),
        "hr": hr_val,
        "cad": cad_val,
        "atemp": int(motion.temperature_c),
        "time": (plan.start_time + timedelta(seconds=tick)).isoformat(),
        "speed_kmh": plan.speed_kmh,
    }
    push_ride_point(ride_id, point_data)
    set_ride_state(ride_id, tick=tick)

    if tick < duration_s:
        from activities.garmin_simulator_tasks import run_garmin_live_tick
        run_garmin_live_tick.apply_async(
            args=[ride_id, tick + 1, duration_s],
            countdown=1,
        )
        return {"status": "tick", "ride_id": ride_id, "tick": tick}

    set_ride_state(ride_id, status="FINISHING")
    from activities.garmin_simulator_tasks import finish_garmin_ride
    finish_garmin_ride.delay(ride_id)

    return {"status": "final_tick", "ride_id": ride_id, "tick": tick}


def incr_active_rides(delta: int) -> None:
    try:
        state = get_garmin_batch_state()
        current = state.get("rides_active", 0)
        set_garmin_batch_state(rides_active=max(0, current + delta))
    except Exception:
        pass


# ── NEW: Finish ride (GPX, upload, Activity) ─────────────────────
def finish_garmin_ride(ride_id: str) -> dict:
    r = get_redis()

    state = get_ride_state(ride_id)
    if not state:
        return {"status": "error", "message": "no ride state"}

    user_id = state["user_id"]
    plan_dict = json.loads(state.get("plan_json", "{}"))
    plan = RidePlan.from_dict(plan_dict)

    points = get_ride_points(ride_id)
    duration_s = state.get("duration_s", 0)

    incr_active_rides(-1)

    if len(points) < 2:
        garmin_batch_log(f"WARNING: Ride {ride_id} has only {len(points)} points — skipping GPX")
        remove_ride_keys(ride_id)
        return {"status": "skipped", "ride_id": ride_id, "points": len(points)}

    gpx_xml = generate_gpx_from_live_points(points, plan)

    end_time = plan.start_time + timedelta(seconds=duration_s)
    distance_m = plan.distance_km * 1000.0
    user = _get_user(user_id)
    if not user:
        remove_ride_keys(ride_id)
        return {"status": "error", "message": f"user {user_id} not found"}

    try:
        from activities.garmin_upload import GarminUploadService
        garmin_activity_id = GarminUploadService.upload_for_user(
            user, gpx_xml, _ride_name(plan)
        )
    except Exception as exc:
        garmin_batch_log(f"WARNING: Garmin upload failed for ride {ride_id}: {exc}")
        garmin_activity_id = None

    route_path = None
    try:
        from django.contrib.gis.geos import LineString
        coords_xy = [(p["lon"], p["lat"]) for p in points if "lon" in p and "lat" in p]
        if len(coords_xy) >= 2:
            route_path = LineString(coords_xy, srid=4326)
    except Exception:
        pass

    gpx_body = gpx_xml.encode("utf-8")
    gpx_sha256 = hashlib.sha256(gpx_body).hexdigest()

    storage_key = ""
    try:
        from activities.gpx_storage import store_gpx
        storage_key = f"garmin_sim/{user.username}/{plan.date.isoformat()}_{plan.start_time.strftime('%H%M')}.gpx"
        store_gpx(storage_key, gpx_body)
    except Exception:
        pass

    from activities.models import Activity
    Activity.objects.create(
        user=user,
        tenant=user.tenant,
        type="BIKE",
        start_time=plan.start_time,
        end_time=end_time,
        distance=distance_m,
        duration=timedelta(seconds=duration_s),
        external_source="GARMIN" if garmin_activity_id else None,
        external_id=str(garmin_activity_id) if garmin_activity_id else None,
        is_verified=True,
        verification_score=1.0,
        route_path=route_path,
        gpx_storage_key=storage_key,
        gpx_sha256=gpx_sha256,
    )

    state_batch = get_garmin_batch_state()
    rides_done = state_batch.get("rides_done", 0) + 1
    total_rides = state_batch.get("total_rides", 1)
    pct = round(rides_done / max(1, total_rides) * 100, 1)

    set_garmin_batch_state(rides_done=rides_done, progress_pct=pct)

    if rides_done >= total_rides:
        set_garmin_batch_state(phase="complete", progress_pct=100.0, running=False)

    garmin_batch_log(
        f"Ride {ride_id}: FINISHED — {len(points)} points, "
        f"{plan.distance_km}km, GPX={len(gpx_xml)}B"
        + (f", GarminID={garmin_activity_id}" if garmin_activity_id else "")
    )

    remove_ride_keys(ride_id)
    return {
        "status": "complete",
        "ride_id": ride_id,
        "points": len(points),
        "garmin_id": garmin_activity_id,
    }


# ── User utilities ───────────────────────────────────────────────
def _create_sim_users(credentials: list[dict[str, str]], count: int, user_names: list[dict[str, str]] | None = None) -> list[Any]:
    from django.contrib.auth import get_user_model
    from users.models import Tenant

    from activities.models import GarminSimulatorCredential

    User = get_user_model()

    tenant, _ = Tenant.objects.get_or_create(
        name="Garmin Sim",
        defaults={"name": "Garmin Sim", "is_active": True, "max_users": 500},
    )

    users = []
    users_summary = []
    for i in range(count):
        username = f"garmin_sim_{i + 1:02d}"
        first_name, last_name, display_name = generate_polish_name(i)
        if user_names and i < len(user_names):
            nm = user_names[i]
            first_name = nm.get("first", first_name)
            last_name = nm.get("last", last_name)
            display_name = nm.get("display", f"{first_name} {last_name}")
        cred = credentials[i] if i < len(credentials) else {"email": f"sim{i + 1:02d}@test.local", "password": ""}
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": cred.get("email", f"sim{i + 1:02d}@test.local"),
                "first_name": first_name,
                "last_name": last_name,
                "tenant": tenant,
                "is_active": True,
            },
        )
        if not created:
            user.first_name = first_name
            user.last_name = last_name
            user.tenant = tenant
            user.is_active = True
            user.email = cred.get("email", user.email)
            user.save(update_fields=["first_name", "last_name", "tenant", "is_active", "email"])

        GarminSimulatorCredential.objects.update_or_create(
            user=user,
            defaults={
                "garmin_email": cred.get("email", ""),
                "garmin_password": cred.get("password", ""),
                "is_active": True,
            },
        )
        users.append(user)
        users_summary.append({
            "index": i + 1,
            "username": username,
            "display_name": display_name,
            "first_name": first_name,
            "last_name": last_name,
            "email": cred.get("email", ""),
            "user_id": user.id,
        })

    store_garmin_summary(users_summary)
    return users


def _get_user(user_id: int) -> Any | None:
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None
