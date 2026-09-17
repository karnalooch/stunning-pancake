from rest_framework import serializers

from .models import Club, ClubChallenge, ClubMembership


class ClubSerializer(serializers.ModelSerializer):
    """Serializer for tenant-scoped Club read/update operations."""

    member_count = serializers.SerializerMethodField()
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
        read_only_fields = ["id", "tenant_id", "created_at", "member_count"]

    def get_member_count(self, obj: Club) -> int:
        memberships = obj.memberships.filter(status="ACTIVE")
        if obj.tenant_id:
            memberships = memberships.filter(user__tenant_id=obj.tenant_id)
        return memberships.count()


class ClubCreateSerializer(serializers.ModelSerializer):
    """Create a club without trusting client-supplied tenant context."""

    class Meta:
        model = Club
        fields = ["name", "slug", "description", "logo", "sport_type", "tenant_id"]
        extra_kwargs = {"tenant_id": {"required": False}}

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["owner"] = user

        if getattr(user, "role", None) == "GLOBAL_OWNER":
            return super().create(validated_data)

        tenant_id = getattr(user, "tenant_id", None)
        if tenant_id is None:
            raise serializers.ValidationError({"tenant_id": "tenant_context_required"})
        validated_data["tenant_id"] = str(tenant_id)
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
    """Serializer for ClubChallenge list/detail with tenant-safe writes."""

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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or getattr(user, "role", None) == "GLOBAL_OWNER":
            return

        tenant_id = getattr(user, "tenant_id", None)
        clubs = (
            Club.objects.none()
            if tenant_id is None
            else Club.objects.filter(tenant_id=str(tenant_id))
        )
        self.fields["challenger"].queryset = clubs
        self.fields["opponent"].queryset = clubs

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or getattr(user, "role", None) == "GLOBAL_OWNER":
            return attrs

        tenant_id = getattr(user, "tenant_id", None)
        if tenant_id is None:
            raise serializers.ValidationError({"tenant": "tenant_context_required"})
        tenant_id = str(tenant_id)

        challenger = attrs.get("challenger", getattr(self.instance, "challenger", None))
        opponent = attrs.get("opponent", getattr(self.instance, "opponent", None))
        if challenger is None or opponent is None:
            return attrs
        if challenger.tenant_id != tenant_id or opponent.tenant_id != tenant_id:
            raise serializers.ValidationError(
                {"detail": "Both clubs must belong to the authenticated tenant."}
            )
        return attrs
