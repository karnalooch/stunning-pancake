from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from core.sport_scope import (
    ALLOWED_ACTIVITY_TYPES,
    is_allowed_activity_type,
    normalize_activity_type,
)

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


class RiderActivityDetailSerializer(serializers.ModelSerializer):
    """Public detail contract for the activity owner in the mobile app.

    Keep this allow-list intentionally small. Moderation, integration, storage
    and GPX-forensics fields belong to elevated operational surfaces.
    """

    route_coords = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = (
            "id",
            "type",
            "start_time",
            "end_time",
            "distance",
            "duration",
            "is_verified",
            "verification_score",
            "rejection_reason",
            "route_coords",
            "created_at",
        )

    def get_route_coords(self, obj):
        if obj.route_path:
            return list(obj.route_path.coords)
        return None

    def get_duration(self, obj):
        if obj.duration:
            return obj.duration.total_seconds()
        return None


class POISerializer(serializers.ModelSerializer):
    # write_only: the model stores coordinates in `location` (PointField), so these
    # input fields have no matching attribute on the instance. Without write_only,
    # DRF's to_representation would call getattr(instance, "latitude") and raise
    # AttributeError (HTTP 500) for any saved POI. Read values are injected in
    # to_representation() below.
    latitude = serializers.FloatField(required=True, write_only=True)
    longitude = serializers.FloatField(required=True, write_only=True)
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
        loc = getattr(instance, "location", None)
        ret["latitude"] = getattr(loc, "y", None) if loc is not None else None
        ret["longitude"] = getattr(loc, "x", None) if loc is not None else None
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
    client_request_id = serializers.CharField(
        required=False,
        allow_blank=False,
        max_length=64,
        write_only=True,
    )

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
            "rejection_reason",
            "route_path",
            "client_request_id",
        )
        read_only_fields = (
            "id",
            "user",
            "is_verified",
            "verification_score",
            "rejection_reason",
        )

    def get_user_info(self, obj):
        return {"id": obj.user.id, "username": obj.user.username}

    def get_duration(self, obj):
        if obj.duration:
            return obj.duration.total_seconds()
        return None

    @staticmethod
    def _validate_replay(existing: Activity, validated_data: dict) -> Activity:
        if (
            existing.type != validated_data.get("type")
            or existing.start_time != validated_data.get("start_time")
            or existing.tenant_id != validated_data.get("tenant_id")
        ):
            raise serializers.ValidationError({"client_request_id": "idempotency_conflict"})
        return existing

    def create(self, validated_data):
        """Bind every API-created activity to its tenant and dedupe create retries.

        The mobile durability queue retries the same ``start_time`` after a lost
        response. When a client does not send an explicit request id, that stable
        timestamp becomes the request identity so a retry replays the original row.
        A database constraint is the final race-proof boundary. Reusing a request
        id for a different payload fails closed instead of silently returning an
        unrelated activity.
        """

        user = validated_data.get("user")
        tenant_id = getattr(user, "tenant_id", None)
        if tenant_id is None:
            raise serializers.ValidationError({"tenant": "tenant_context_required"})
        validated_data["tenant_id"] = tenant_id

        client_request_id = validated_data.get("client_request_id")
        if not client_request_id:
            start_time = validated_data.get("start_time")
            if start_time is not None:
                client_request_id = f"start:{start_time.isoformat()}"
                validated_data["client_request_id"] = client_request_id

        if not client_request_id:
            return super().create(validated_data)

        existing = Activity.objects.filter(
            user=user,
            client_request_id=client_request_id,
        ).first()
        if existing:
            return self._validate_replay(existing, validated_data)

        try:
            with transaction.atomic():
                return super().create(validated_data)
        except IntegrityError:
            existing = Activity.objects.get(
                user=user,
                client_request_id=client_request_id,
            )
            return self._validate_replay(existing, validated_data)


class ActivityCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for starting a new activity.
    """

    event_id = serializers.IntegerField(required=False, write_only=True)
    client_request_id = serializers.CharField(
        required=False,
        allow_blank=False,
        max_length=64,
        write_only=True,
    )

    class Meta:
        model = Activity
        fields = ("type", "start_time", "event_id", "client_request_id")

    def validate_type(self, value: str) -> str:
        normalized = normalize_activity_type(value)
        if not is_allowed_activity_type(normalized):
            raise serializers.ValidationError(
                f"Unsupported activity type. Allowed: {', '.join(ALLOWED_ACTIVITY_TYPES)}"
            )
        return normalized

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
