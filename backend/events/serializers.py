"""
Events Serializers — SPORT Platform
"""
from rest_framework import serializers

from .models import Achievement, Event, Participation


class EventSerializer(serializers.ModelSerializer):
    """Full event detail serializer with boundary support."""

    class Meta:
        model = Event
        fields = [
            "id", "title", "slug", "description",
            "event_type", "sport_filter", "status",
            "start_date", "end_date",
            "tenant_id", "opponent_tenant_id",
            "club", "opponent_club",
            "require_brouter_validation",
            "created_at",
        ]


class ParticipationSerializer(serializers.ModelSerializer):
    """Participation stats for a user in an event."""
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Participation
        fields = ["id", "event", "user", "username", "total_km",
                  "total_elevation_m", "activity_count", "score", "last_updated"]


class AchievementSerializer(serializers.ModelSerializer):
    """Achievement badge serializer."""
    event_title = serializers.CharField(source="event.title", read_only=True, allow_null=True)

    class Meta:
        model = Achievement
        fields = ["id", "achievement_type", "title", "description",
                  "icon", "awarded_at", "metadata", "event_title"]


class EventLeaderboardSerializer(serializers.Serializer):
    """Leaderboard entry (read-only, computed)."""
    rank = serializers.IntegerField()
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    total_km = serializers.FloatField()
    score = serializers.FloatField()
    activity_count = serializers.IntegerField()
