import os

import requests
from django.contrib.gis.geos import Point, LineString
from django.utils import timezone
from .models import PrivacyZone

class BRouterService:
    """
    Client for interacting with the BRouter engine.
    Used for topological track validation and anti-cheat checks.
    """
    BASE_URL = os.getenv('BROUTER_URL', 'http://brouter:17777/brouter').rstrip('/')
    PROFILE_MAP = {
        'RUN': 'foot-all',
        'BIKE': 'bicycle',
        'WALK': 'foot-all',
        'WHEELCHAIR': 'wheelchair',
    }

    @classmethod
    def _timeout_seconds(cls) -> float:
        try:
            return float(os.getenv('BROUTER_TIMEOUT', '30'))
        except (TypeError, ValueError):
            return 30.0

    @classmethod
    def profile_for_activity(cls, activity_type: str) -> str:
        return cls.PROFILE_MAP.get(activity_type, 'foot-all')

    @classmethod
    def extract_line_coordinates(cls, data: dict) -> list[tuple[float, float]]:
        """Return (lat, lon) points from BRouter GeoJSON FeatureCollection."""
        features = data.get('features') or []
        for feature in features:
            geom = feature.get('geometry') or {}
            if geom.get('type') != 'LineString':
                continue
            coords = geom.get('coordinates') or []
            points = []
            for c in coords:
                if not c or len(c) < 2:
                    continue
                points.append((float(c[1]), float(c[0])))
            if len(points) >= 2:
                return points
        return []

    @classmethod
    def validate_track(cls, activity_type, coordinates):
        """
        Sends a track to BRouter to check if it's feasible for the given activity type.
        """
        profile = cls.profile_for_activity(activity_type)

        # Format coordinates for BRouter (lon,lat|lon,lat...)
        coord_str = "|".join([f"{c[0]},{c[1]}" for c in coordinates])

        params = {
            'lonlats': coord_str,
            'profile': profile,
            'alternativeidx': 0,
            'format': 'geojson',
        }

        try:
            response = requests.get(
                cls.BASE_URL,
                params=params,
                timeout=cls._timeout_seconds(),
            )
            if response.status_code == 200:
                try:
                    data = response.json()
                except ValueError:
                    return {
                        'success': False,
                        'error': f'non-JSON response: {response.text[:200]}',
                    }
                points = cls.extract_line_coordinates(data)
                if not points:
                    return {
                        'success': False,
                        'error': 'no LineString in GeoJSON response',
                        'raw_data': data,
                    }
                props = (data.get('features') or [{}])[0].get('properties') or {}
                return {
                    'success': True,
                    'brouter_distance': props.get('track-length'),
                    'raw_data': data,
                    'coordinates': points,
                }
            err = (response.text or '').strip()
            if len(err) > 300:
                err = err[:300] + '…'
            return {
                'success': False,
                'error': f'HTTP {response.status_code}: {err}',
                'status_code': response.status_code,
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

# Privacy Zone v2 — Default radii per zone type (metres)
_ZONE_RADII_M: dict[str, float] = {
    "HOME":   250.0,   # Wider default for home address
    "WORK":   150.0,   # Work location
    "CUSTOM":  75.0,   # User-defined custom zone
}
_DENSITY_BOOST_FACTOR = 1.5   # Radius multiplier when area is "popular"
_DENSITY_BOOST_THRESHOLD = 3  # N other users' zones in same area → boost


class PrivacyService:
    """
    Privacy Masking Service v2 (Milestone 3) — Constitution §10.1.

    Improvements over v1:
    - Dynamic radius per zone type (HOME > WORK > CUSTOM).
    - Density boost: expands radius if ≥N other users share a nearby zone.
    - Segment gap bridging: fills removed segments with linear interpolation
      instead of leaving hard breaks that could reveal zone boundary location.
    - GDPR-compliant: no raw coordinates stored post-masking.
    """

    @classmethod
    def get_effective_radius(cls, zone: "PrivacyZone") -> float:
        """
        Returns the effective masking radius in metres for a given zone.

        Applies a density boost if multiple users have zones nearby,
        making it harder to triangulate the real address from track cutoffs.

        Args:
            zone: The PrivacyZone model instance.

        Returns:
            Effective radius in metres.
        """
        base_radius = getattr(zone, "radius", None) or _ZONE_RADII_M.get(
            getattr(zone, "zone_type", "CUSTOM"), 75.0
        )

        # Density boost: check how many other zones are within 500m
        nearby_count = PrivacyZone.objects.exclude(pk=zone.pk).filter(
            center__distance_lte=(zone.center, 500)
        ).count()

        if nearby_count >= _DENSITY_BOOST_THRESHOLD:
            return base_radius * _DENSITY_BOOST_FACTOR

        return base_radius

    @classmethod
    def mask_track(cls, user, route_path) -> "LineString | None":
        """
        Removes GPS points within privacy zones and bridges the gaps
        with linear interpolation to obscure zone boundaries.

        Algorithm:
        1. Load all user's privacy zones.
        2. For each point, compute effective radius (type + density).
        3. Mark point as private if within any zone.
        4. If 1+ consecutive private points are found, replace the
           entire private segment with a straight interpolated line
           between the last public and first public points.

        Args:
            user: Django User instance.
            route_path: LineString of raw GPS coordinates.

        Returns:
            Masked LineString or None if too short after masking.
        """
        if not route_path:
            return route_path

        zones = list(PrivacyZone.objects.filter(user=user).select_related(None))
        if not zones:
            return route_path

        # Precompute effective radii once
        effective_radii = {z.pk: cls.get_effective_radius(z) for z in zones}

        # Tag each point as public/private
        visibility: list[bool] = []  # True = public
        for point in route_path.coords:
            p = Point(point[0], point[1], srid=4326)
            p_merc = p.transform(3857, clone=True)
            is_private = False
            for zone in zones:
                zone_merc = zone.center.transform(3857, clone=True)
                if p_merc.distance(zone_merc) <= effective_radii[zone.pk]:
                    is_private = True
                    break
            visibility.append(not is_private)

        coords = list(route_path.coords)
        masked_points: list[tuple] = []
        i = 0

        while i < len(coords):
            if visibility[i]:
                masked_points.append(coords[i])
                i += 1
            else:
                # Find the end of the private segment
                j = i
                while j < len(coords) and not visibility[j]:
                    j += 1

                # Bridge: interpolate a single midpoint between last public
                # and first public point to avoid a hard cut at zone boundary
                if masked_points and j < len(coords):
                    lon_mid = (masked_points[-1][0] + coords[j][0]) / 2
                    lat_mid = (masked_points[-1][1] + coords[j][1]) / 2
                    masked_points.append((lon_mid, lat_mid))

                i = j

        if len(masked_points) < 2:
            return None  # Track too short after masking

        return LineString(masked_points, srid=4326)

class MatrixService:
    """
    Service for sending notifications to Matrix (E2EE Chat).
    Used for alerting moderators about fraud detections.
    """
    HOMESERVER = os.getenv('MATRIX_HOMESERVER', 'https://matrix.org')
    ACCESS_TOKEN = os.getenv('MATRIX_TOKEN', 'placeholder_token')

    @classmethod
    def send_alert(cls, room_id, message):
        """
        Sends a simple text message to a Matrix room.
        """
        url = f"{cls.HOMESERVER}/_matrix/client/r0/rooms/{room_id}/send/m.room.message"
        headers = {"Authorization": f"Bearer {cls.ACCESS_TOKEN}"}
        payload = {
            "msgtype": "m.text",
            "body": f"🚨 [SPORT_ALERT]: {message}"
        }
        try:
            # We skip actual request in dev to avoid errors
            if cls.ACCESS_TOKEN != 'placeholder_token':
                requests.post(url, json=payload, headers=headers, timeout=5)
            return True
        except Exception:
            return False


class TelemetryService:
    """
    Client for interacting with the Traccar GPS tracking server.
    Also supports Redis-backed simulator positions for when Traccar is unavailable.

    At scale (100k+ pool), only *active riders* are stored in Redis (hash + GEO index).
    Reads use GEORADIUS + HMGET — never HGETALL.
    """
    BASE_URL = os.getenv('TRACCAR_URL', 'http://traccar:8082/api')
    USER = os.getenv('TRACCAR_USER', 'admin')
    PASS = os.getenv('TRACCAR_PASS', 'admin')
    TELEMETRY_REDIS_PREFIX = 'telemetry:'
    TELEMETRY_REDIS_TTL = 120  # 2 min — positions expire if not refreshed
    TELEMETRY_LIVE_CACHE_PREFIX = '{telemetry}:live:'
    _devices_cache: tuple[float, list] | None = None
    _DEVICES_CACHE_TTL = 60

    @classmethod
    def _positions_key(cls) -> str:
        return f'{cls.TELEMETRY_REDIS_PREFIX}positions'

    @classmethod
    def _geo_key(cls) -> str:
        return f'{cls.TELEMETRY_REDIS_PREFIX}geo'

    @classmethod
    def _encode_entry(cls, e: dict) -> tuple[str, str, float, float]:
        import json as _json
        device_id = str(e.get('deviceId', ''))
        lat = float(e.get('lat', 0))
        lon = float(e.get('lng', 0))
        payload = _json.dumps({
            'id': device_id,
            'deviceId': device_id,
            'name': e.get('name', f'Athlete {device_id}'),
            'type': e.get('type', 'person'),
            'latitude': lat,
            'longitude': lon,
            'speed': e.get('speed', 0),
            'course': e.get('course', 0),
            'deviceTime': timezone.now().isoformat(),
            'category': e.get('type', 'person'),
        })
        return device_id, payload, lon, lat

    @classmethod
    def push_simulator_position(cls, device_id: str, lat: float, lon: float,
                                 speed: float = 0.0, course: float = 0.0,
                                 name: str = '', device_type: str = 'person'):
        """Push a single simulator-generated position to Redis for live map display."""
        from core.redis_cluster import get_redis
        device_id, payload, lon, lat = cls._encode_entry({
            'deviceId': device_id, 'lat': lat, 'lng': lon,
            'speed': speed, 'course': course, 'name': name, 'type': device_type,
        })
        r = get_redis()
        r.hset(cls._positions_key(), device_id, payload)
        r.geoadd(cls._geo_key(), (lon, lat, device_id))
        r.expire(cls._positions_key(), cls.TELEMETRY_REDIS_TTL + 30)
        r.expire(cls._geo_key(), cls.TELEMETRY_REDIS_TTL + 30)

    @classmethod
    def replace_active_positions(cls, entries: list[dict], merge: bool = False):
        """
        Replace simulator telemetry for currently riding athletes only.
        Full replace each tick keeps Redis bounded (≤ MAX_CONCURRENT_RIDERS).
        """
        from core.redis_cluster import get_redis
        from activities.scale_config import MAX_TELEMETRY_PUBLISH_PER_TICK

        if not entries:
            if not merge:
                r = get_redis()
                r.delete(cls._positions_key(), cls._geo_key())
            return

        entries = entries[:MAX_TELEMETRY_PUBLISH_PER_TICK]
        r = get_redis()
        pos_key = cls._positions_key()
        geo_key = cls._geo_key()

        if not merge:
            r.delete(pos_key, geo_key)

        pipe = r.pipeline()
        for e in entries:
            device_id, payload, lon, lat = cls._encode_entry(e)
            if not device_id:
                continue
            pipe.hset(pos_key, device_id, payload)
            pipe.geoadd(geo_key, (lon, lat, device_id))
        pipe.expire(pos_key, cls.TELEMETRY_REDIS_TTL + 30)
        pipe.expire(geo_key, cls.TELEMETRY_REDIS_TTL + 30)
        pipe.execute()

    @classmethod
    def push_bulk_positions(cls, entries: list[dict]):
        """Publish positions for all active riders (replaces previous snapshot)."""
        cls.replace_active_positions(entries, merge=False)

    @classmethod
    def _bbox_radius_km(cls, west: float, south: float, east: float, north: float) -> float:
        import math
        lat_mid = (south + north) / 2.0
        dx = (east - west) * 111.0 * math.cos(math.radians(lat_mid))
        dy = (north - south) * 111.0
        return max(1.0, math.sqrt(dx * dx + dy * dy) / 2.0)

    @classmethod
    def _live_cache_key(cls, bbox: tuple[float, float, float, float] | None, cap: int) -> str:
        import hashlib
        bbox_s = ','.join(f'{x:.4f}' for x in bbox) if bbox else 'all'
        digest = hashlib.sha256(f'{bbox_s}|{cap}'.encode()).hexdigest()[:20]
        return f'{cls.TELEMETRY_LIVE_CACHE_PREFIX}{digest}'

    @classmethod
    def _get_live_cached(cls, key: str) -> tuple[list[dict], dict] | None:
        import json as _json
        from activities.scale_config import TELEMETRY_LIVE_CACHE_TTL
        if TELEMETRY_LIVE_CACHE_TTL <= 0:
            return None
        try:
            from core.redis_cluster import get_redis
            raw = get_redis().get(key)
            if raw:
                payload = _json.loads(raw.decode() if isinstance(raw, bytes) else raw)
                meta = dict(payload.get('meta', {}))
                meta['cached'] = True
                return payload.get('positions', []), meta
        except Exception:
            pass
        return None

    @classmethod
    def _set_live_cached(cls, key: str, positions: list[dict], meta: dict) -> None:
        import json as _json
        from activities.scale_config import TELEMETRY_LIVE_CACHE_TTL
        if TELEMETRY_LIVE_CACHE_TTL <= 0:
            return
        try:
            from core.redis_cluster import get_redis
            get_redis().setex(
                key,
                TELEMETRY_LIVE_CACHE_TTL,
                _json.dumps({'positions': positions, 'meta': {**meta, 'cached': False}}),
            )
        except Exception:
            pass

    @classmethod
    def _fetch_redis_positions_per_city(
        cls,
        r,
        cap: int,
        geo_radius_km: float,
    ) -> tuple[list[dict], dict]:
        """Guarantee geographic spread at country zoom — sample near each city hub."""
        import json as _json
        from simulate_active_cities import CITIES

        pos_key = cls._positions_key()
        geo_key = cls._geo_key()
        try:
            from activities import simulator_state as sim_state
            active_riding = sim_state.get_live_ride_count()
        except Exception:
            active_riding = int(r.hlen(pos_key) or 0)

        per_city = max(8, cap // max(len(CITIES), 1))
        meta = {
            'returned': 0,
            'capped': False,
            'redis_active': active_riding,
            'active_riding': active_riding,
            'telemetry_positions': int(r.hlen(pos_key) or 0),
            'source': 'redis',
            'fetch_mode': 'per_city',
        }
        seen: set[str] = set()
        id_list: list[str] = []
        radius_km = min(max(float(geo_radius_km), 35.0), 120.0)

        for city in CITIES:
            device_ids = r.georadius(
                geo_key, city['lon'], city['lat'], radius_km,
                unit='km', count=per_city, sort='ASC',
            )
            for d in device_ids or []:
                did = d.decode() if isinstance(d, bytes) else str(d)
                if did not in seen:
                    seen.add(did)
                    id_list.append(did)
                if len(id_list) >= cap:
                    meta['capped'] = True
                    break
            if len(id_list) >= cap:
                break

        positions: list[dict] = []
        if not id_list:
            meta['returned'] = 0
            return positions, meta

        raw_vals = r.hmget(pos_key, id_list)
        for pos_json in raw_vals:
            if not pos_json:
                continue
            try:
                positions.append(
                    _json.loads(pos_json.decode() if isinstance(pos_json, bytes) else pos_json),
                )
            except Exception:
                continue
            if len(positions) >= cap:
                meta['capped'] = True
                break

        meta['returned'] = len(positions)
        return positions[:cap], meta

    @classmethod
    def _fetch_redis_positions(
        cls,
        r,
        bbox: tuple[float, float, float, float] | None,
        cap: int,
        geo_radius_km: float,
        zoom: float | None = None,
    ) -> tuple[list[dict], dict]:
        import json as _json

        pos_key = cls._positions_key()
        geo_key = cls._geo_key()
        try:
            from activities import simulator_state as sim_state
            active_riding = sim_state.get_live_ride_count()
        except Exception:
            active_riding = int(r.hlen(pos_key) or 0)

        meta = {
            'returned': 0,
            'capped': False,
            'redis_active': active_riding,
            'active_riding': active_riding,
            'telemetry_positions': int(r.hlen(pos_key) or 0),
            'source': 'redis',
        }
        positions: list[dict] = []
        country_overview = zoom is not None and zoom < 8

        if country_overview:
            return cls._fetch_redis_positions_per_city(r, cap, geo_radius_km)

        if bbox:
            west, south, east, north = bbox
            center_lon = (west + east) / 2.0
            center_lat = (south + north) / 2.0
            bbox_radius = cls._bbox_radius_km(west, south, east, north) * 1.25
            # Cover the full viewport (country zoom); floor at configured default
            radius_km = min(max(bbox_radius, float(geo_radius_km)), 450.0)
        else:
            center_lon, center_lat = 19.1344, 51.9194
            radius_km = float(geo_radius_km)

        device_ids = r.georadius(
            geo_key, center_lon, center_lat, radius_km,
            unit='km', count=cap, sort='ASC',
        )
        if not device_ids:
            meta['returned'] = 0
            return positions, meta

        id_list = [d.decode() if isinstance(d, bytes) else d for d in device_ids]
        raw_vals = r.hmget(pos_key, id_list)
        for pos_json in raw_vals:
            if not pos_json:
                continue
            try:
                pos = _json.loads(pos_json.decode() if isinstance(pos_json, bytes) else pos_json)
                if bbox and not country_overview:
                    west, south, east, north = bbox
                    lon = pos.get('longitude', pos.get('lng', 0))
                    lat = pos.get('latitude', pos.get('lat', 0))
                    if not (west <= lon <= east and south <= lat <= north):
                        continue
                positions.append(pos)
            except Exception:
                continue
            if len(positions) >= cap:
                meta['capped'] = True
                break

        meta['returned'] = len(positions)
        return positions[:cap], meta

    @classmethod
    def get_live_positions(
        cls,
        bbox: tuple[float, float, float, float] | None = None,
        limit: int | None = None,
        zoom: float | None = None,
    ) -> tuple[list[dict], dict]:
        """
        Fetch positions without scanning the full Redis hash.
        Returns (positions, meta) where meta includes counts and cap info.
        """
        from core.redis_cluster import get_redis
        from activities.scale_config import (
            TELEMETRY_GEO_RADIUS_KM,
            resolve_telemetry_api_limit,
        )

        cap = resolve_telemetry_api_limit(limit, zoom)
        cache_key = cls._live_cache_key(bbox, cap) if bbox else None
        if cache_key:
            cached = cls._get_live_cached(cache_key)
            if cached is not None:
                return cached

        positions: list[dict] = []
        meta: dict = {
            'returned': 0,
            'capped': False,
            'redis_active': 0,
            'source': 'redis',
        }

        try:
            r = get_redis()
            positions, meta = cls._fetch_redis_positions(
                r, bbox, cap, float(TELEMETRY_GEO_RADIUS_KM), zoom=zoom,
            )
            if positions:
                if cache_key:
                    cls._set_live_cached(cache_key, positions, meta)
                return positions, meta
        except Exception:
            pass

        # Traccar fallback only when Redis has no active riders (avoids 2s timeout per poll)
        try:
            response = requests.get(
                f'{cls.BASE_URL}/positions',
                auth=(cls.USER, cls.PASS),
                timeout=2,
            )
            if response.status_code == 200:
                raw = response.json() if isinstance(response.json(), list) else []
                positions.extend(raw[:cap])
                meta['source'] = 'traccar'
                meta['returned'] = len(positions)
        except Exception:
            pass

        if cache_key and positions:
            cls._set_live_cached(cache_key, positions, meta)
        return positions[:cap], meta

    @classmethod
    def get_devices(cls):
        """Fetches metadata about registered devices (athletes). Cached briefly."""
        import time
        now = time.time()
        if cls._devices_cache and (now - cls._devices_cache[0]) < cls._DEVICES_CACHE_TTL:
            return cls._devices_cache[1]
        try:
            response = requests.get(
                f'{cls.BASE_URL}/devices',
                auth=(cls.USER, cls.PASS),
                timeout=3,
            )
            if response.status_code == 200:
                result = response.json()
                if not isinstance(result, list):
                    result = []
                cls._devices_cache = (now, result)
                return result
            return []
        except Exception:
            return []

    @classmethod
    def clear_simulator_positions(cls):
        """Remove all simulator-generated positions from Redis."""
        from core.redis_cluster import get_redis
        r = get_redis()
        r.delete(cls._positions_key(), cls._geo_key())

import random

class AntiCheatEngine:
    """
    Core engine for verifying telemetry tracks using Kinematics and BRouter topological mapping.
    """
    
    @staticmethod
    def get_recent_anomalies(tenant_id=None, limit=20):
        from .models import Activity
        qs = Activity.objects.filter(is_verified=False)
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
            
        anomalies = qs.order_by('-created_at')[:limit]
        
        result = []
        for a in anomalies:
            result.append({
                "id": f"AN-{a.id}",
                "activity_id": a.id,
                "user": a.user.username,
                "type": a.type,
                "score": round(a.verification_score, 2),
                "time": a.start_time.isoformat(),
                "distance": a.distance,
                "duration": str(a.duration) if a.duration else None
            })
        return result
