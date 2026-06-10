from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from .models import POI, Activity, PrivacyZone


class ActivityDetailSerializer(serializers.ModelSerializer):
    user_info = serializers.SerializerMethodField()
    route_coords = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = "__all__"

    def get_user_info(self, obj):
        return {"id": obj.user.id, "username": obj.user.username, "role": obj.user.role}

    def get_route_coords(self, obj):
        if obj.route_path:
            return list(obj.route_path.coords)
        return None

    def get_duration(self, obj):
        if obj.duration:
            return obj.duration.total_seconds()
        return None


class POISerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(required=True)
    longitude = serializers.FloatField(required=True)
    tenant_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = POI
        fields = (
            "id",
            "name",
            "latitude",
            "longitude",
            "category",
            "description",
            "tenant_id",
            "sponsor_id",
        )
        read_only_fields = ("id",)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.location:
            ret["latitude"] = instance.location.y
            ret["longitude"] = instance.location.x
        return ret

    def create(self, validated_data):
        from django.contrib.gis.geos import Point

        lat = validated_data.pop("latitude")
        lng = validated_data.pop("longitude")
        validated_data["location"] = Point(lng, lat, srid=4326)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        from django.contrib.gis.geos import Point

        lat = validated_data.pop("latitude", None)
        lng = validated_data.pop("longitude", None)
        if lat is not None and lng is not None:
            instance.location = Point(lng, lat, srid=4326)
        return super().update(instance, validated_data)


class ActivitySerializer(serializers.ModelSerializer):
    """
    Serializer for recording and retrieving activities.
    Handles PostGIS LineString for the route.
    """

    user_info = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = (
            "id",
            "user",
            "user_info",
            "type",
            "start_time",
            "end_time",
            "distance",
            "duration",
            "is_verified",
            "verification_score",
            "route_path",
        )
        read_only_fields = ("id", "user", "is_verified", "verification_score")

    def get_user_info(self, obj):
        return {"id": obj.user.id, "username": obj.user.username}

    def get_duration(self, obj):
        if obj.duration:
            return obj.duration.total_seconds()
        return None


class ActivityCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for starting a new activity.
    """

    event_id = serializers.IntegerField(required=False, write_only=True)

    class Meta:
        model = Activity
        fields = ("type", "start_time", "event_id")

    def create(self, validated_data):
        validated_data.pop("event_id", None)
        return super().create(validated_data)


class PrivacyZoneSerializer(GeoFeatureModelSerializer):
    """
    GeoJSON Serializer for Privacy Zones.
    """

    class Meta:
        model = PrivacyZone
        geo_field = "center"
        fields = ("id", "label", "radius")
