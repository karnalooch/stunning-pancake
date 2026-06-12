from rest_framework import serializers

from .models import PlatformNotice


class PlatformNoticeSerializer(serializers.ModelSerializer):
    tenant_id = serializers.UUIDField(source="tenant.id", read_only=True, allow_null=True)

    class Meta:
        model = PlatformNotice
        fields = (
            "id",
            "severity",
            "title_pl",
            "title_en",
            "body_pl",
            "body_en",
            "tenant",
            "tenant_id",
            "starts_at",
            "ends_at",
            "is_active",
            "dismissible",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class ActivePlatformNoticeSerializer(serializers.ModelSerializer):
    """Mobile/public read — localized title/body selected client-side."""

    class Meta:
        model = PlatformNotice
        fields = (
            "id",
            "severity",
            "title_pl",
            "title_en",
            "body_pl",
            "body_en",
            "dismissible",
            "starts_at",
            "ends_at",
        )
