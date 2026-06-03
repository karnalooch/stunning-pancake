from rest_framework import serializers
from .models import Club, ClubMembership, ClubChallenge


class ClubSerializer(serializers.ModelSerializer):
    """Serializer for Club read/list operations."""

    member_count = serializers.IntegerField(read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)

    class Meta:
        model = Club
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "logo",
            "sport_type",
            "tenant_id",
            "owner_username",
            "member_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "member_count"]


class ClubCreateSerializer(serializers.ModelSerializer):
    """Serializer for Club creation — sets owner automatically."""

    class Meta:
        model = Club
        fields = ["name", "slug", "description", "logo", "sport_type", "tenant_id"]

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


class ClubMembershipSerializer(serializers.ModelSerializer):
    """Serializer for club membership details."""

    username = serializers.CharField(source="user.username", read_only=True)
    avatar = serializers.ImageField(source="user.avatar", read_only=True)

    class Meta:
        model = ClubMembership
        fields = ["id", "username", "avatar", "role", "status", "total_km", "joined_at"]
        read_only_fields = ["id", "joined_at", "total_km"]


class ClubChallengeSerializer(serializers.ModelSerializer):
    """Serializer for ClubChallenge list/detail."""

    challenger_name = serializers.CharField(source="challenger.name", read_only=True)
    opponent_name = serializers.CharField(source="opponent.name", read_only=True)
    winner_name = serializers.CharField(source="winner.name", read_only=True, allow_null=True)

    class Meta:
        model = ClubChallenge
        fields = [
            "id",
            "title",
            "sport_type",
            "challenger",
            "challenger_name",
            "challenger_score",
            "opponent",
            "opponent_name",
            "opponent_score",
            "winner",
            "winner_name",
            "status",
            "start_date",
            "end_date",
            "created_at",
        ]
        read_only_fields = ["id", "challenger_score", "opponent_score", "winner", "created_at"]
