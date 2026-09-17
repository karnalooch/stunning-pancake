from rest_framework import serializers

from .models import AuditLog, Tenant, User


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ("id", "name", "primary_color", "secondary_color", "is_active")


class AuditLogSerializer(serializers.ModelSerializer):
    """List/detail serializer with immutable identity fallback after user deletion."""

    impersonator_username = serializers.SerializerMethodField()
    target_user_username = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "timestamp",
            "action",
            "status_code",
            "ip_address",
            "tenant_id",
            "details",
            "impersonator",
            "target_user",
            "impersonator_username",
            "target_user_username",
        )

    def get_impersonator_username(self, obj: AuditLog) -> str | None:
        if obj.impersonator_id and obj.impersonator:
            return obj.impersonator.username
        return obj.impersonator_username_snapshot

    def get_target_user_username(self, obj: AuditLog) -> str | None:
        if obj.target_user_id and obj.target_user:
            return obj.target_user.username
        return obj.target_user_username_snapshot


class UserSerializer(serializers.ModelSerializer):
    tenant_id = serializers.PrimaryKeyRelatedField(
        source="tenant",
        queryset=Tenant.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    tenant_name = serializers.CharField(source="tenant.name", read_only=True, default="")
    tenant_flags = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "role",
            "tenant_id",
            "tenant_name",
            "tenant_flags",
            "avatar",
            "bio",
            "is_active",
        )
        read_only_fields = ("id", "role")

    def get_tenant_flags(self, obj: User) -> dict:
        tenant = getattr(obj, "tenant", None)
        if not tenant:
            return {"has_heatmap_analytics": False}
        return {"has_heatmap_analytics": bool(tenant.has_heatmap_analytics)}


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    username = serializers.CharField(min_length=3, max_length=150)

    class Meta:
        model = User
        # Registration is tenant-neutral. Tenant membership is selected only
        # after authentication through the guarded onboarding/profile path.
        fields = ("username", "email", "password")

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data.pop("password"),
            role="ATHLETE",
        )
        return user


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True, min_length=8)

    def validate_new_password(self, value):
        if value.isdigit():
            raise serializers.ValidationError("Password cannot be entirely numeric.")
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters.")
        return value


class UserAdminUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "role",
            "tenant_id",
            "is_active",
            "avatar",
            "bio",
            "password",
        )
