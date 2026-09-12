from rest_framework import serializers

from activities.models_webhooks import LiveMapAlertWebhook
from activities.ssrf import UnsafeWebhookURL, validate_outbound_url


def _validate_outbound_url(value: str) -> str:
    """Shared SSRF guard used by both the serializer and the worker."""
    try:
        return validate_outbound_url(value)
    except UnsafeWebhookURL as exc:
        # Surface a short, redacted reason to the API client; the full URL
        # and any userinfo must never appear in the error message.
        raise serializers.ValidationError({"url": [str(exc)]})


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
        read_only_fields = (
            "last_delivery_at",
            "failure_count",
            "delivery_log",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {
            "secret": {"write_only": True},
            "tenant": {"required": False},
        }

    def validate_url(self, value: str) -> str:
        return _validate_outbound_url(value)

    def validate(self, attrs):
        # Re-run the SSRF guard when the URL field is present in ``update``
        # payloads that may arrive as partial dicts without touching the
        # ``url`` field validator explicitly.
        url = attrs.get("url")
        if url:
            _validate_outbound_url(url)
        return attrs
