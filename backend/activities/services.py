import os
import threading
import time

import requests
from requests.adapters import HTTPAdapter
from django.contrib.gis.geos import Point, LineString
from django.utils import timezone
from .models import PrivacyZone


class BRouterService:
    """
    Client for interacting with the BRouter engine.
    Used for topological track validation and anti-cheat checks.

    Multiple Railway services (brouter + brouter-2) share load via BROUTER_URLS
    (comma-separated). Falls back to BROUTER_URL when unset.
    """

    PROFILE_MAP = {
        "RUN": "foot-all",
        "BIKE": "bicycle",
        "WALK": "foot-all",
        "WHEELCHAIR": "wheelchair",
    }
    UNROUTABLE_ERROR_CODE = "BROUTER_UNROUTABLE_START"
    TRANSPORT_ERROR_CODE = "BROUTER_TRANSPORT_FAILURE"
    _http_session: requests.Session | None = None
    _base_urls_cache: tuple[str, ...] | None = None
    _rr_lock = threading.Lock()
    _rr_index = 0

    @classmethod
    def _load_base_urls(cls) -> list[str]:
        multi = (os.getenv("BROUTER_URLS") or "").strip()
        if multi:
            urls = [u.strip().rstrip("/") for u in multi.split(",") if u.strip()]
            if urls:
                return urls
        single = (os.getenv("BROUTER_URL") or "http://brouter:17777/brouter").strip().rstrip("/")
        return [single or "http://brouter:17777/brouter"]

    @classmethod
    def base_urls(cls) -> tuple[str, ...]:
        if cls._base_urls_cache is None:
            cls._base_urls_cache = tuple(cls._load_base_urls())
        return cls._base_urls_cache

    @classmethod
    def primary_base_url(cls) -> str:
        return cls.base_urls()[0]

    @classmethod
    def endpoints_display(cls) -> str:
        urls = cls.base_urls()
        return urls[0] if len(urls) == 1 else ",".join(urls)

    @classmethod
    def _next_request_index(cls, url_count: int) -> int:
        with cls._rr_lock:
            idx = cls._rr_index
            cls._rr_index = (idx + 1) % max(1, url_count)
            return idx

    @classmethod
    def _url_for_attempt(cls, start_index: int, attempt: int, urls: tuple[str, ...]) -> str:
        return urls[(start_index + attempt) % len(urls)]

    @classmethod
    def _timeout_seconds(cls) -> float:
        try:
            return float(os.getenv("BROUTER_TIMEOUT", "30"))
        except (TypeError, ValueError):
            return 30.0

    @classmethod
    def _retry_count(cls) -> int:
        try:
            return max(1, int(os.getenv("BROUTER_RETRIES", "3")))
        except (TypeError, ValueError):
            return 3

    @classmethod
    def _http_pool_size(cls) -> int:
        try:
            return max(8, int(os.getenv("BROUTER_HTTP_POOL_SIZE", "24")))
        except (TypeError, ValueError):
            return 24

    @classmethod
    def _http(cls) -> requests.Session:
        if cls._http_session is None:
            session = requests.Session()
            pool_size = cls._http_pool_size()
            adapter = HTTPAdapter(pool_connections=pool_size, pool_maxsize=pool_size)
            session.mount("http://", adapter)
            session.mount("https://", adapter)
            cls._http_session = session
        return cls._http_session

    @classmethod
    def profile_for_activity(cls, activity_type: str) -> str:
        return cls.PROFILE_MAP.get(activity_type, "foot-all")

    @classmethod
    def classify_error(cls, error: str | None, status_code: int | None = None) -> dict:
        """
        Split retryable "no route from this start" failures from hard infrastructure errors.
        """
        text = (error or "").strip()
        normalized = text.lower()
        status = int(status_code or 0)
        is_connection_drop = (
            "remotedisconnected" in normalized
            or "connection aborted" in normalized
            or "connection reset" in normalized
            or "connection refused" in normalized
            or "broken pipe" in normalized
        )
        is_unroutable = (
            "target island" in normalized
            or "pass=0" in normalized
            or "no route found" in normalized
        )
        if status == 400 and is_unroutable:
            return {
                "severity": "warning",
                "retryable": True,
                "code": cls.UNROUTABLE_ERROR_CODE,
                "message": text or "Start point not routable on road graph.",
            }
        if is_connection_drop or status >= 500 or status in (0, 502, 503, 504):
            return {
                "severity": "error",
                "retryable": True,
                "code": cls.TRANSPORT_ERROR_CODE,
                "message": text or (f"HTTP {status}" if status else "Transport failure"),
            }
        return {
            "severity": "error",
            "retryable": False,
            "code": cls.TRANSPORT_ERROR_CODE,
            "message": text or (f"HTTP {status}" if status else "Unknown routing failure"),
        }

    @classmethod
    def extract_line_coordinates(cls, data: dict) -> list[tuple[float, float]]:
        """Return (lat, lon) points from BRouter GeoJSON FeatureCollection."""
        features = data.get("features") or []
        for feature in features:
            geom = feature.get("geometry") or {}
            if geom.get("type") != "LineString":
                continue
            coords = geom.get("coordinates") or []
            points = []
            for c in coords:
                if not c or len(c) < 2:
                    continue
                points.append((float(c[1]), float(c[0])))
            if len(points) >= 2:
                return points
        return []

    @classmethod
    def validate_track(cls, activity_type, coordinates, profile: str | None = None):
        """
        Sends a track to BRouter to check if it's feasible for the given activity type.
        Optional profile override (e.g. trekking fallback when bicycle cannot snap pass=0).
        """
        profile = profile or cls.profile_for_activity(activity_type)

        # Format coordinates for BRouter (lon,lat|lon,lat...)
        coord_str = "|".join([f"{c[0]},{c[1]}" for c in coordinates])

        params = {
            "lonlats": coord_str,
            "profile": profile,
            "alternativeidx": 0,
            "format": "geojson",
        }

        last_exc = None
        retries = cls._retry_count()
        urls = cls.base_urls()
        start_index = cls._next_request_index(len(urls))
        for attempt in range(retries):
            base_url = cls._url_for_attempt(start_index, attempt, urls)
            try:
                response = cls._http().get(
                    base_url,
                    params=params,
                    timeout=cls._timeout_seconds(),
                )
                if response.status_code == 200:
                    try:
                        data = response.json()
                    except ValueError:
                        return {
                            "success": False,
                            "error": f"non-JSON response: {response.text[:200]}",
                        }
                    points = cls.extract_line_coordinates(data)
                    if not points:
                        return {
                            "success": False,
                            "error": "no LineString in GeoJSON response",
                            "raw_data": data,
                        }
                    props = (data.get("features") or [{}])[0].get("properties") or {}
                    return {
                        "success": True,
                        "brouter_distance": props.get("track-length"),
                        "raw_data": data,
                        "coordinates": points,
                    }
                err = (response.text or "").strip()
                if len(err) > 300:
                    err = err[:300] + "…"
                classification = cls.classify_error(err, response.status_code)
                if (
                    attempt + 1 < retries
                    and classification.get("retryable")
                    and classification.get("code") == cls.TRANSPORT_ERROR_CODE
                ):
                    time.sleep(0.15 * (attempt + 1))
                    continue
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {err}",
                    "status_code": response.status_code,
                    "classification": classification,
                }
            except requests.exceptions.RequestException as e:
                last_exc = e
                if attempt + 1 < retries:
                    time.sleep(0.15 * (attempt + 1))
                    continue
                return {
                    "success": False,
                    "error": str(e),
                    "classification": cls.classify_error(str(e), 0),
                }
        return {
            "success": False,
            "error": str(last_exc or "unknown error"),
            "classification": cls.classify_error(str(last_exc), 0),
        }


# Privacy Zone v2 — Default radii per zone type (metres)
_ZONE_RADII_M: dict[str, float] = {
    "HOME": 250.0,  # Wider default for home address
    "WORK": 150.0,  # Work location
    "CUSTOM": 75.0,  # User-defined custom zone
}
_DENSITY_BOOST_FACTOR = 1.5  # Radius multiplier when area is "popular"
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
        nearby_count = (
            PrivacyZone.objects.exclude(pk=zone.pk)
            .filter(center__distance_lte=(zone.center, 500))
            .count()
        )

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

    HOMESERVER = os.getenv("MATRIX_HOMESERVER", "https://matrix.org")
    ACCESS_TOKEN = os.getenv("MATRIX_TOKEN", "placeholder_token")

    @classmethod
    def send_alert(cls, room_id, message):
        """
        Sends a simple text message to a Matrix room.
        """
        url = f"{cls.HOMESERVER}/_matrix/client/r0/rooms/{room_id}/send/m.room.message"
        headers = {"Authorization": f"Bearer {cls.ACCESS_TOKEN}"}
        payload = {"msgtype": "m.text", "body": f"🚨 [SPORT_ALERT]: {message}"}
        try:
            # We skip actual request in dev to avoid errors
            if cls.ACCESS_TOKEN != "placeholder_token":
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

    BASE_URL = os.getenv("TRACCAR_URL", "http://traccar:8082/api")
    USER = os.getenv("TRACCAR_USER", "admin")
    PASS = os.getenv("TRACCAR_PASS", "admin")
    TELEMETRY_REDIS_PREFIX = "telemetry:"
    TELEMETRY_REDIS_TTL = 120  # 2 min — positions expire if not refreshed
    TELEMETRY_LIVE_CACHE_PREFIX = "{telemetry}:live:"
    _devices_cache: tuple[float, list] | None = None
    _DEVICES_CACHE_TTL = 60

    @classmethod
    def _positions_key(cls) -> str:
        """Legacy single-shard positions key (shard 0). Kept for backward compat."""
        from activities.telemetry_shard import shard_keys

        return shard_keys(0).positions

    @classmethod
    def _geo_key(cls) -> str:
        """Legacy single-shard GEO key (shard 0). Kept for backward compat."""
        from activities.telemetry_shard import shard_keys

        return shard_keys(0).geo

    @classmethod
    def _encode_entry(cls, e: dict) -> tuple[str, str, float, float]:
        import json as _json

        device_id = str(e.get("deviceId", ""))
        lat = float(e.get("lat", 0))
        lon = float(e.get("lng", 0))
        payload = _json.dumps(
            {
                "id": device_id,
                "deviceId": device_id,
                "name": e.get("name", f"Athlete {device_id}"),
                "type": e.get("type", "person"),
                "latitude": lat,
                "longitude": lon,
                "speed": e.get("speed", 0),
                "course": e.get("course", 0),
                "deviceTime": timezone.now().isoformat(),
                "category": e.get("type", "person"),
            }
        )
        return device_id, payload, lon, lat

    @classmethod
    def push_simulator_position(
        cls,
        device_id: str,
        lat: float,
        lon: float,
        speed: float = 0.0,
        course: float = 0.0,
        name: str = "",
        device_type: str = "person",
    ):
        """Push a single simulator-generated position to Redis for live map display."""
        from activities.telemetry_shard import TelemetryShardRouter, keys_for_device

        device_id, payload, lon, lat = cls._encode_entry(
            {
                "deviceId": device_id,
                "lat": lat,
                "lng": lon,
                "speed": speed,
                "course": course,
                "name": name,
                "type": device_type,
            }
        )
        sk = keys_for_device(device_id)
        r = TelemetryShardRouter.client_for(sk.index)
        r.hset(sk.positions, device_id, payload)
        r.geoadd(sk.geo, (lon, lat, device_id))
        r.expire(sk.positions, cls.TELEMETRY_REDIS_TTL + 30)
        r.expire(sk.geo, cls.TELEMETRY_REDIS_TTL + 30)

    @classmethod
    def replace_active_positions(cls, entries: list[dict], merge: bool = False):
        """
        Replace simulator telemetry for currently riding athletes only.
        Full replace each tick keeps Redis bounded (≤ MAX_CONCURRENT_RIDERS).
        """
        from activities.scale_config import MAX_TELEMETRY_PUBLISH_PER_TICK
        from activities.telemetry_shard import (
            TelemetryShardRouter,
            all_shard_keys,
            shard_for_device,
            shard_count,
        )

        n_shards = shard_count()
        all_keys = all_shard_keys(n_shards)

        if not entries:
            if not merge:
                for sk in all_keys:
                    TelemetryShardRouter.client_for(sk.index).delete(
                        sk.positions, sk.geo
                    )
            return

        entries = entries[:MAX_TELEMETRY_PUBLISH_PER_TICK]

        # Always-on ingest signal (fail-open; never blocks the snapshot publish).
        cls._record_ingest_load(len(entries))

        if not merge:
            for sk in all_keys:
                TelemetryShardRouter.client_for(sk.index).delete(sk.positions, sk.geo)

        by_shard: dict[int, list[tuple[str, str, float, float]]] = {}
        for e in entries:
            device_id, payload, lon, lat = cls._encode_entry(e)
            if not device_id:
                continue
            idx = shard_for_device(device_id, n_shards)
            by_shard.setdefault(idx, []).append((device_id, payload, lon, lat))

        ttl = cls.TELEMETRY_REDIS_TTL + 30
        for idx, rows in by_shard.items():
            sk = all_keys[idx]
            r = TelemetryShardRouter.client_for(idx)
            pipe = r.pipeline()
            for device_id, payload, lon, lat in rows:
                pipe.hset(sk.positions, device_id, payload)
                pipe.geoadd(sk.geo, (lon, lat, device_id))
            pipe.expire(sk.positions, ttl)
            pipe.expire(sk.geo, ttl)
            pipe.execute()

    @classmethod
    def _record_ingest_load(cls, n: int) -> None:
        """Feed the global always-on ingest signal. Best-effort, never raises."""
        try:
            from core.load_guard import check_ingest

            check_ingest(n)
        except Exception:
            pass

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
    def _live_cache_key(
        cls,
        bbox: tuple[float, float, float, float] | None,
        cap: int,
        zoom: float | None = None,
    ) -> str:
        import hashlib

        bbox_s = ",".join(f"{x:.4f}" for x in bbox) if bbox else "all"
        z = f"{zoom:.1f}" if zoom is not None else "na"
        digest = hashlib.sha256(f"{bbox_s}|{cap}|{z}".encode()).hexdigest()[:20]
        return f"{cls.TELEMETRY_LIVE_CACHE_PREFIX}{digest}"

    @classmethod
    def _get_live_cached(
        cls, key: str, cache_ttl: int | None = None
    ) -> tuple[list[dict], dict] | None:
        import json as _json
        from activities.scale_config import TELEMETRY_LIVE_CACHE_TTL

        ttl = cache_ttl if cache_ttl is not None else TELEMETRY_LIVE_CACHE_TTL
        if ttl <= 0:
            return None
        try:
            from core.redis_cluster import get_redis

            raw = get_redis().get(key)
            if raw:
                payload = _json.loads(raw.decode() if isinstance(raw, bytes) else raw)
                positions = payload.get("positions") or []
                if not positions:
                    return None
                meta = dict(payload.get("meta", {}))
                meta["cached"] = True
                return positions, meta
        except Exception:
            pass
        return None

    @classmethod
    def _set_live_cached(
        cls, key: str, positions: list[dict], meta: dict, cache_ttl: int | None = None
    ) -> None:
        import json as _json
        from activities.scale_config import TELEMETRY_LIVE_CACHE_TTL

        ttl = cache_ttl if cache_ttl is not None else TELEMETRY_LIVE_CACHE_TTL
        if ttl <= 0:
            return
        try:
            from core.redis_cluster import get_redis

            get_redis().setex(
                key,
                ttl,
                _json.dumps({"positions": positions, "meta": {**meta, "cached": False}}),
            )
        except Exception:
            pass

    @classmethod
    def _total_positions(cls, r=None) -> int:
        """Sum of position-hash sizes across all telemetry shards."""
        from concurrent.futures import ThreadPoolExecutor, as_completed

        from activities.telemetry_shard import (
            TelemetryShardRouter,
            all_shard_keys,
            parallel_shard_workers,
        )

        shards = all_shard_keys()
        if len(shards) <= 1:
            client = r or TelemetryShardRouter.client_for(0)
            try:
                return int(client.hlen(shards[0].positions) or 0)
            except Exception:
                return 0

        def _hlen(sk):
            try:
                return int(TelemetryShardRouter.client_for(sk.index).hlen(sk.positions) or 0)
            except Exception:
                return 0

        total = 0
        workers = parallel_shard_workers(len(shards))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_hlen, sk) for sk in shards]
            for fut in as_completed(futures):
                total += fut.result()
        return total

    @classmethod
    def _geo_query_one_shard(
        cls,
        sk,
        center_lon: float,
        center_lat: float,
        radius_km: float,
        count: int,
    ) -> list[tuple[str, dict]]:
        """GEORADIUS + HMGET on a single shard. Returns (device_id, position) pairs."""
        import json as _json

        from activities.telemetry_shard import TelemetryShardRouter

        r = TelemetryShardRouter.client_for(sk.index)
        try:
            device_ids = r.georadius(
                sk.geo,
                center_lon,
                center_lat,
                radius_km,
                unit="km",
                count=count,
                sort="ASC",
            )
        except Exception:
            return []

        id_list: list[str] = []
        for d in device_ids or []:
            id_list.append(d.decode() if isinstance(d, bytes) else str(d))
        if not id_list:
            return []

        try:
            raw_vals = r.hmget(sk.positions, id_list)
        except Exception:
            return []

        out: list[tuple[str, dict]] = []
        for did, pos_json in zip(id_list, raw_vals):
            if not pos_json:
                continue
            try:
                pos = _json.loads(
                    pos_json.decode() if isinstance(pos_json, bytes) else pos_json
                )
                out.append((did, pos))
            except Exception:
                continue
        return out

    @classmethod
    def _geo_query_shards(
        cls,
        r,
        center_lon: float,
        center_lat: float,
        radius_km: float,
        count: int,
    ) -> list[dict]:
        """
        Fan a GEORADIUS query across every shard in parallel, then merge.
        Returns parsed position dicts (deduped, capped at `count`).
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        from activities.telemetry_shard import all_shard_keys, parallel_shard_workers

        shards = all_shard_keys()
        if len(shards) <= 1:
            pairs = cls._geo_query_one_shard(
                shards[0], center_lon, center_lat, radius_km, count
            )
            return [pos for _did, pos in pairs[:count]]

        positions: list[dict] = []
        seen: set[str] = set()
        workers = parallel_shard_workers(len(shards))

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(
                    cls._geo_query_one_shard,
                    sk,
                    center_lon,
                    center_lat,
                    radius_km,
                    count,
                ): sk
                for sk in shards
            }
            shard_hits: list[list[tuple[str, dict]]] = []
            for fut in as_completed(futures):
                try:
                    shard_hits.append(fut.result())
                except Exception:
                    continue

        for pairs in shard_hits:
            for did, pos in pairs:
                if did in seen:
                    continue
                seen.add(did)
                positions.append(pos)
                if len(positions) >= count:
                    return positions
        return positions

    @classmethod
    def _fetch_redis_positions_per_city(
        cls,
        r,
        cap: int,
        geo_radius_km: float,
    ) -> tuple[list[dict], dict]:
        """Guarantee geographic spread at country zoom — sample near each city hub."""
        from simulate_active_cities import CITIES

        total_positions = cls._total_positions(r)
        try:
            from activities import simulator_state as sim_state

            active_riding = sim_state.get_live_ride_count()
        except Exception:
            active_riding = total_positions

        per_city = max(8, cap // max(len(CITIES), 1))
        meta = {
            "returned": 0,
            "capped": False,
            "redis_active": active_riding,
            "active_riding": active_riding,
            "telemetry_positions": total_positions,
            "source": "redis",
            "fetch_mode": "per_city",
        }
        radius_km = min(max(float(geo_radius_km), 35.0), 120.0)

        positions: list[dict] = []
        seen: set[str] = set()
        for city in CITIES:
            if len(positions) >= cap:
                meta["capped"] = True
                break
            city_positions = cls._geo_query_shards(
                r, city["lon"], city["lat"], radius_km, per_city
            )
            for pos in city_positions:
                did = str(pos.get("deviceId") or pos.get("id") or "")
                if did and did in seen:
                    continue
                if did:
                    seen.add(did)
                positions.append(pos)
                if len(positions) >= cap:
                    meta["capped"] = True
                    break

        meta["returned"] = len(positions)
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
        total_positions = cls._total_positions(r)
        try:
            from activities import simulator_state as sim_state

            active_riding = sim_state.get_live_ride_count()
        except Exception:
            active_riding = total_positions

        meta = {
            "returned": 0,
            "capped": False,
            "redis_active": active_riding,
            "active_riding": active_riding,
            "telemetry_positions": total_positions,
            "source": "redis",
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

        raw_positions = cls._geo_query_shards(r, center_lon, center_lat, radius_km, cap)
        if not raw_positions:
            meta["returned"] = 0
            return positions, meta

        for pos in raw_positions:
            if bbox and not country_overview:
                west, south, east, north = bbox
                lon = pos.get("longitude", pos.get("lng", 0))
                lat = pos.get("latitude", pos.get("lat", 0))
                if not (west <= lon <= east and south <= lat <= north):
                    continue
            positions.append(pos)
            if len(positions) >= cap:
                meta["capped"] = True
                break

        meta["returned"] = len(positions)
        return positions[:cap], meta

    @classmethod
    def get_live_positions(
        cls,
        bbox: tuple[float, float, float, float] | None = None,
        limit: int | None = None,
        zoom: float | None = None,
        *,
        skip_cache: bool = False,
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

        from activities.telemetry_shard import apply_live_map_cap, live_map_read_policy

        read_policy = live_map_read_policy()
        cap = resolve_telemetry_api_limit(limit, zoom)
        cap = apply_live_map_cap(cap, read_policy)
        if cap <= 0:
            try:
                from activities import simulator_state as sim_state

                active_riding = sim_state.get_live_ride_count()
            except Exception:
                active_riding = 0
            meta_empty = {
                "returned": 0,
                "capped": False,
                "redis_active": active_riding,
                "active_riding": active_riding,
                "source": "redis",
                "ingest_engaged": read_policy.ingest_engaged,
                "live_read_throttled": read_policy.ingest_engaged,
            }
            if read_policy.ingest_engaged:
                meta_empty["live_poll_interval_multiplier"] = read_policy.poll_interval_multiplier
                meta_empty["live_detail_ceiling"] = read_policy.detail_ceiling
            return [], meta_empty

        from activities.scale_config import TELEMETRY_LIVE_CACHE_TTL

        effective_cache_ttl = TELEMETRY_LIVE_CACHE_TTL
        if read_policy.ingest_engaged and read_policy.cache_ttl_seconds > 0:
            effective_cache_ttl = max(TELEMETRY_LIVE_CACHE_TTL, read_policy.cache_ttl_seconds)

        cache_key = cls._live_cache_key(bbox, cap, zoom) if bbox else None
        if cache_key and not skip_cache:
            cached = cls._get_live_cached(cache_key, effective_cache_ttl)
            if cached is not None:
                return cached

        positions: list[dict] = []
        meta: dict = {
            "returned": 0,
            "capped": False,
            "redis_active": 0,
            "source": "redis",
            "ingest_engaged": read_policy.ingest_engaged,
            "live_read_throttled": read_policy.ingest_engaged,
        }
        if read_policy.ingest_engaged:
            meta["live_poll_interval_multiplier"] = read_policy.poll_interval_multiplier
            meta["live_detail_ceiling"] = read_policy.detail_ceiling
            meta["live_cache_ttl_seconds"] = read_policy.cache_ttl_seconds

        try:
            r = get_redis()
            positions, meta = cls._fetch_redis_positions(
                r,
                bbox,
                cap,
                float(TELEMETRY_GEO_RADIUS_KM),
                zoom=zoom,
            )
            if positions and cache_key:
                cls._set_live_cached(cache_key, positions, meta, effective_cache_ttl)
            if positions:
                return positions, meta
        except Exception:
            pass

        # Traccar fallback only when Redis has no active riders (avoids 2s timeout per poll)
        try:
            response = requests.get(
                f"{cls.BASE_URL}/positions",
                auth=(cls.USER, cls.PASS),
                timeout=2,
            )
            if response.status_code == 200:
                raw = response.json() if isinstance(response.json(), list) else []
                positions.extend(raw[:cap])
                meta["source"] = "traccar"
                meta["returned"] = len(positions)
        except Exception:
            pass

        if cache_key and positions:
            cls._set_live_cached(cache_key, positions, meta, effective_cache_ttl)
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
                f"{cls.BASE_URL}/devices",
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
        """Remove all simulator-generated positions from Redis (all shards)."""
        from activities.telemetry_shard import TelemetryShardRouter, all_shard_keys

        for sk in all_shard_keys():
            TelemetryShardRouter.client_for(sk.index).delete(sk.positions, sk.geo)


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

        anomalies = qs.order_by("-created_at")[:limit]

        result = []
        for a in anomalies:
            result.append(
                {
                    "id": f"AN-{a.id}",
                    "activity_id": a.id,
                    "user": a.user.username,
                    "type": a.type,
                    "score": round(a.verification_score, 2),
                    "time": a.start_time.isoformat(),
                    "distance": a.distance,
                    "duration": str(a.duration) if a.duration else None,
                }
            )
        return result
