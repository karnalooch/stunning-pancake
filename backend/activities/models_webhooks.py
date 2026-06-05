"""Live Map alert webhook configuration per tenant."""

from __future__ import annotations

from django.db import models


class LiveMapAlertWebhook(models.Model):
    EVENT_CHOICES = [
        ("viewport_capped", "Viewport capped"),
        ("sync_stale", "Sync stale"),
        ("flagged_spike", "Flagged spike"),
        ("zero_positions_anomaly", "Zero positions anomaly"),
        ("test_ping", "Test ping"),
    ]

    tenant = models.ForeignKey(
        "users.Tenant",
        on_delete=models.CASCADE,
        related_name="live_map_webhooks",
    )
    url = models.URLField(max_length=500)
    secret = models.CharField(max_length=128, help_text="HMAC signing secret")
    events = models.JSONField(
        default=list,
        blank=True,
        help_text="Subscribed event names, e.g. ['viewport_capped', 'sync_stale']",
    )
    enabled = models.BooleanField(default=True)
    last_delivery_at = models.DateTimeField(null=True, blank=True)
    failure_count = models.PositiveIntegerField(default=0)
    delivery_log = models.JSONField(
        default=list,
        blank=True,
        help_text="Last N delivery attempts (newest first), max 10",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"LiveMapWebhook({self.tenant_id}, {self.url[:40]})"


MAX_DELIVERY_LOG = 10


def append_delivery_log(webhook_id: int, entry: dict) -> None:
    """Prepend delivery attempt; keep newest MAX_DELIVERY_LOG entries."""
    wh = LiveMapAlertWebhook.objects.only("delivery_log").filter(pk=webhook_id).first()
    if not wh:
        return
    log = list(wh.delivery_log or [])
    log.insert(0, entry)
    LiveMapAlertWebhook.objects.filter(pk=webhook_id).update(delivery_log=log[:MAX_DELIVERY_LOG])
