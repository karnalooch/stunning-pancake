"""
Events Serializers — SPORT Platform
"""

from rest_framework import serializers
from .models import Event, Participation, Achievement


class EventSerializer(serializers.ModelSerializer):
    """Full event detail serializer with boundary support."""

    boundary = serializers.JSONField(required=False, allow_null=True)
    burst_protection = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "event_type",
            "sport_filter",
            "status",
            "start_date",
            "end_date",
            "tenant_id",
            "opponent_tenant_id",
            "club",
            "opponent_club",
            "require_brouter_validation",
            "boundary",
            "created_at",
            "burst_protection",
        ]

    def get_burst_protection(self, obj):
        request = self.context.get("request")
        user = (
            request.user
            if request and getattr(request, "user", None) and request.user.is_authenticated
            else None
        )
        from events.burst import burst_protection_meta
        from events.scale_config import EVENT_MAX_CONCURRENT_RIDERS

        meta = burst_protection_meta(
            obj,
            user=user,
            lightweight=self.context.get("burst_lightweight", False),
        )
        if "max_concurrent_riders_hint" not in meta:
            meta["max_concurrent_riders_hint"] = EVENT_MAX_CONCURRENT_RIDERS
        return meta

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.boundary:
            ret["boundary"] = {"type": "Polygon", "coordinates": list(instance.boundary.coords)}
        return ret

    def validate_boundary(self, value):
        if value is None:
            return None
        import json
        from django.contrib.gis.geos import GEOSGeometry

        try:
            if isinstance(value, dict):
                geom_str = json.dumps(value)
            else:
                geom_str = value
            geom = GEOSGeometry(geom_str)
            if geom.geom_type != "Polygon":
                raise serializers.ValidationError("Boundary geometry must be a Polygon.")
            return geom
        except Exception as e:
            raise serializers.ValidationError(f"Invalid GeoJSON Polygon: {str(e)}")


class ParticipationSerializer(serializers.ModelSerializer):
    """Participation stats for a user in an event."""

    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Participation
        fields = [
            "id",
            "event",
            "user",
            "username",
            "total_km",
            "total_elevation_m",
            "activity_count",
            "score",
            "last_updated",
        ]


class AchievementSerializer(serializers.ModelSerializer):
    """Achievement badge serializer."""

    event_title = serializers.CharField(source="event.title", read_only=True, allow_null=True)

    class Meta:
        model = Achievement
        fields = [
            "id",
            "achievement_type",
            "title",
            "description",
            "icon",
            "awarded_at",
            "metadata",
            "event_title",
        ]


class EventLeaderboardSerializer(serializers.Serializer):
    """Leaderboard entry (read-only, computed)."""

    rank = serializers.IntegerField()
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    total_km = serializers.FloatField()
    score = serializers.FloatField()
    activity_count = serializers.IntegerField()
