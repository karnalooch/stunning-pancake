from rest_framework import serializers

from activities.models_webhooks import LiveMapAlertWebhook
from activities.ssrf import UnsafeWebhookURL, validate_outbound_url


def _validate_outbound_url(value: str) -> str:
    """Shared SSRF guard used by both the serializer and the worker.

    Returns the original URL on success. Raises ``serializers.ValidationError``
    with a flat, field-level error shape (``{"url": [<safe message>]}``) on
    failure. The full URL, hostname, resolved addresses, userinfo, port value
    and query string must never appear in the surfaced message.
    """
    try:
        return validate_outbound_url(value)
    except UnsafeWebhookURL:
        # Keep the public error fixed. Detailed SSRF rejection reasons remain
        # internal so user-controlled URL material can never flow into API text.
        raise serializers.ValidationError(["Webhook URL is not allowed."])


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
        # DRF runs ``validate_<field>`` on both full and partial updates when
        # ``url`` is present in the payload — no second pass is needed.
        return _validate_outbound_url(value)
