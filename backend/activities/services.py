import requests
import json
import os
from django.conf import settings

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

from django.contrib.gis.geos import Point, LineString
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
            is_private = False
            for zone in zones:
                if p.distance(zone.center) * 100000 <= zone.radius: # Rough conversion or use proper GIS distance
                    is_private = True
                    break
            
            if not is_private:
                masked_points.append(point)
        
        if len(masked_points) < 2:
            return None # Track too short after masking
            
        return LineString(masked_points, srid=4326)
