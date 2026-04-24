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

class PrivacyService:
    """
    Service for applying privacy masking to GPS tracks.
    Implementation of Article 10 of the Constitution.
    """
    @classmethod
    def mask_track(cls, user, route_path):
        """
        Removes points from the LineString that fall within any of the user's privacy zones.
        """
        if not route_path:
            return route_path
            
        zones = PrivacyZone.objects.filter(user=user)
        if not zones.exists():
            return route_path

        masked_points = []
        for point in route_path.coords:
            p = Point(point[0], point[1], srid=4326)
            # Transform to metric projection (EPSG:3857) for accurate meter-based distance
            p_merc = p.transform(3857, clone=True)
            is_private = False
            for zone in zones:
                zone_merc = zone.center.transform(3857, clone=True)
                if p_merc.distance(zone_merc) <= zone.radius:  # Distance now in meters
                    is_private = True
                    break
            
            if not is_private:
                masked_points.append(point)
        
        if len(masked_points) < 2:
            return None # Track too short after masking
            
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
