from rest_framework import serializers
from .models import User, Tenant, AuditLog


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ("id", "name", "primary_color", "secondary_color", "is_active")


class AuditLogSerializer(serializers.ModelSerializer):
    impersonator_username = serializers.CharField(
        source="impersonator.username", read_only=True, default=None
    )
    target_user_username = serializers.CharField(
        source="target_user.username", read_only=True, default=None
    )

    class Meta:
        model = AuditLog
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenant.name", read_only=True, default="")

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "role",
            "tenant_id",
            "tenant_name",
            "avatar",
            "bio",
            "is_active",
        )
        read_only_fields = ("id", "role")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    username = serializers.CharField(min_length=3, max_length=150)

    class Meta:
        model = User
        fields = ("username", "email", "password", "tenant_id")

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
            tenant_id=validated_data.get("tenant_id"),
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
