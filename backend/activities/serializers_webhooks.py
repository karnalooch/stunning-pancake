from rest_framework import serializers

from activities.models_webhooks import LiveMapAlertWebhook


class LiveMapAlertWebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = LiveMapAlertWebhook
        fields = (
            "id",
            "tenant",
            "url",
            "secret",
            "events",
            "enabled",
            "last_delivery_at",
            "failure_count",
            "delivery_log",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("last_delivery_at", "failure_count", "delivery_log", "created_at", "updated_at")
        extra_kwargs = {"secret": {"write_only": True}}
