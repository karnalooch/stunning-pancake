import os

import requests
from django.contrib.gis.geos import Point, LineString

class BRouterService:
    """
    Client for interacting with the BRouter engine.
    Used for topological track validation and anti-cheat checks.
    """
    BASE_URL = os.getenv('BROUTER_URL', 'http://brouter:17878/brouter')

    @classmethod
    def validate_track(cls, activity_type, coordinates):
        """
        Sends a track to BRouter to check if it's feasible for the given activity type.
        """
        # Mapping SPORT types to BRouter profiles
        profile_map = {
            'RUN': 'foot-all',
            'BIKE': 'bicycle',
            'WALK': 'foot-all',
            'WHEELCHAIR': 'wheelchair'
        }
        
        profile = profile_map.get(activity_type, 'foot-all')
        
        # Format coordinates for BRouter (lon,lat|lon,lat...)
        coord_str = "|".join([f"{c[0]},{c[1]}" for c in coordinates])
        
        params = {
            'lonlats': coord_str,
            'profile': profile,
            'alternativeidx': 0,
            'format': 'geojson'
        }
        
        try:
            response = requests.get(cls.BASE_URL, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                # Basic validation: if BRouter can find a path, the track is "feasible"
                # We can compare the distance from BRouter with the actual GPS distance
                return {
                    "success": True,
                    "brouter_distance": data['features'][0]['properties']['track-length'],
                    "raw_data": data
                }
            return {"success": False, "error": response.text}
        except Exception as e:
            return {"success": False, "error": str(e)}

from .models import PrivacyZone

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
    Used for real-time athlete positioning and history retrieval.
    """
    BASE_URL = os.getenv('TRACCAR_URL', 'http://traccar:8082/api')
    USER = os.getenv('TRACCAR_USER', 'admin')
    PASS = os.getenv('TRACCAR_PASS', 'admin')

    @classmethod
    def get_live_positions(cls):
        """
        Fetches latest positions for all active devices.
        """
        try:
            response = requests.get(
                f"{cls.BASE_URL}/positions",
                auth=(cls.USER, cls.PASS),
                timeout=5
            )
            if response.status_code == 200:
                return response.json()
            return []
        except Exception:
            return []

    @classmethod
    def get_devices(cls):
        """
        Fetches metadata about registered devices (athletes).
        """
        try:
            response = requests.get(
                f"{cls.BASE_URL}/devices",
                auth=(cls.USER, cls.PASS),
                timeout=5
            )
            if response.status_code == 200:
                return response.json()
            return []
        except Exception:
            return []
