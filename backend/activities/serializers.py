from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import Activity, PrivacyZone, POI

class POISerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(source='location.y', read_only=True)
    longitude = serializers.FloatField(source='location.x', read_only=True)

    class Meta:
        model = POI
        fields = ('id', 'name', 'latitude', 'longitude', 'category', 'description')


class ActivitySerializer(serializers.ModelSerializer):
    """
    Serializer for recording and retrieving activities.
    Handles PostGIS LineString for the route.
    """
    class Meta:
        model = Activity
        fields = (
            'id', 'user', 'type', 'start_time', 'end_time', 
            'distance', 'duration', 'is_verified', 
            'verification_score', 'route_path'
        )
        read_only_fields = ('id', 'user', 'is_verified', 'verification_score')

class ActivityCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for starting a new activity.
    """
    class Meta:
        model = Activity
        fields = ('type', 'start_time')

class PrivacyZoneSerializer(GeoFeatureModelSerializer):
    """
    GeoJSON Serializer for Privacy Zones.
    """
    class Meta:
        model = PrivacyZone
        geo_field = 'center'
        fields = ('id', 'label', 'radius')
