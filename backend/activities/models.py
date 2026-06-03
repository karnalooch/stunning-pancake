import logging
import os
import base64
import hashlib
from django.contrib.gis.db import models
from django.conf import settings
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

# Derive a 32-byte Fernet key from SECRET_KEY (or use explicit env var).
# Fernet requires a URL-safe base64-encoded 32-byte key.
_TOKEN_KEY_RAW = os.getenv(
    "TOKEN_ENCRYPTION_KEY",
    base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest()).decode(),
)
_fernet = Fernet(_TOKEN_KEY_RAW.encode() if isinstance(_TOKEN_KEY_RAW, str) else _TOKEN_KEY_RAW)


class Activity(models.Model):
    ACTIVITY_TYPES = (
        ("RUN", "Running"),
        ("BIKE", "Cycling"),
        ("WALK", "Walking"),
        ("WHEELCHAIR", "Wheelchair"),
    )

    EXTERNAL_SOURCES = (
        ("STRAVA", "Strava"),
        ("GARMIN", "Garmin"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activities"
    )
    tenant = models.ForeignKey(
        "users.Tenant", on_delete=models.CASCADE, related_name="activities", null=True, blank=True
    )
    type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    distance = models.FloatField(help_text="Distance in meters", default=0.0)
    duration = models.DurationField(null=True, blank=True)

    # Anti-cheat status
    is_verified = models.BooleanField(default=False)
    verification_score = models.FloatField(default=0.0)

    # PostGIS Path
    route_path = models.LineStringField(srid=4326, null=True, blank=True)

    # Wearable dedupe (Strava/Garmin activity id)
    external_source = models.CharField(
        max_length=20,
        choices=EXTERNAL_SOURCES,
        null=True,
        blank=True,
    )
    external_id = models.CharField(max_length=200, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Activities"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "external_source", "external_id"],
                condition=models.Q(external_id__isnull=False) & ~models.Q(external_id=""),
                name="activities_activity_user_external_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "start_time"]),
            models.Index(fields=["type", "is_verified"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["tenant", "is_verified"]),
            models.Index(fields=["tenant", "created_at"]),
            models.Index(fields=["user", "tenant"]),
        ]

    def save(self, *args, **kwargs):
        # Phase 10: Douglas-Peucker simplification before storage.
        # Reduces GPS track size ~60% with negligible visual fidelity loss.
        if self.route_path and self.route_path.num_coords > 100:
            self.route_path = self.route_path.simplify(
                tolerance=0.00001,  # ~1m at equator
                preserve_topology=True,
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} - {self.type} - {self.start_time.date()}"


class PrivacyZone(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    center = models.PointField(srid=4326)
    radius = models.FloatField(help_text="Radius in meters")
    label = models.CharField(max_length=100, default="Home")

    def __str__(self):
        return f"{self.user.username} Privacy Zone: {self.label}"


class POI(models.Model):
    """
    Point of Interest (Sponsor Location).
    """

    CATEGORY_CHOICES = (
        ("COFFEE", "Coffee Shop"),
        ("SHOP", "Retail Store"),
        ("BIKE", "Bike Shop/Service"),
        ("OTHER", "Other"),
    )

    name = models.CharField(max_length=200)
    location = models.PointField(srid=4326)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="OTHER")
    tenant = models.ForeignKey(
        "users.Tenant", on_delete=models.CASCADE, related_name="pois", null=True, blank=True
    )
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.name} ({self.tenant.name if self.tenant else 'No Tenant'})"


class Voucher(models.Model):
    """
    Redeemable reward linked to a POI.
    """

    poi = models.ForeignKey(POI, on_delete=models.CASCADE, related_name="vouchers")
    code = models.CharField(max_length=50, unique=True)
    discount_value = models.CharField(max_length=100)
    is_redeemed = models.BooleanField(default=False)
    redeemed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    expiry_date = models.DateTimeField()

    def __str__(self):
        return f"{self.code} - {self.poi.name}"


class WearableIntegration(models.Model):
    """
    Stores OAuth credentials for external wearable services (Milestone 4).
    Tokens are encrypted at rest using Fernet (AES-128-CBC + HMAC-SHA256).
    """

    SERVICE_CHOICES = (
        ("STRAVA", "Strava"),
        ("GARMIN", "Garmin"),
        ("APPLE", "Apple HealthKit"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wearables"
    )
    service = models.CharField(max_length=20, choices=SERVICE_CHOICES)

    # OAuth 2.0 — encrypted at rest via save() override
    access_token = models.TextField()
    refresh_token = models.TextField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    # External ID
    external_id = models.CharField(max_length=200, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    last_sync = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "service")

    def __str__(self):
        return f"{self.user.username} - {self.service}"

    def save(self, *args, **kwargs):
        # Encrypt tokens at rest. Always attempt to decrypt first to avoid
        # double-encrypting already encrypted tokens loaded from the DB.
        if self.access_token:
            try:
                _fernet.decrypt(self.access_token.encode())
            except (InvalidToken, UnicodeDecodeError):
                self.access_token = _fernet.encrypt(self.access_token.encode()).decode()
        if self.refresh_token:
            try:
                _fernet.decrypt(self.refresh_token.encode())
            except (InvalidToken, UnicodeDecodeError):
                self.refresh_token = _fernet.encrypt(self.refresh_token.encode()).decode()
        super().save(*args, **kwargs)

    @property
    def decrypted_access_token(self):
        if not self.access_token:
            return None
        try:
            return _fernet.decrypt(self.access_token.encode()).decode()
        except (InvalidToken, UnicodeDecodeError):
            logger.error(f"Failed to decrypt access_token for WearableIntegration id={self.pk}")
            return None

    @property
    def decrypted_refresh_token(self):
        if not self.refresh_token:
            return None
        try:
            return _fernet.decrypt(self.refresh_token.encode()).decode()
        except (InvalidToken, UnicodeDecodeError):
            logger.error(f"Failed to decrypt refresh_token for WearableIntegration id={self.pk}")
            return None


class DiskAuditEvent(models.Model):
    """Append-only audit log for Postgres disk guard actions."""

    EVENT_TYPES = (
        ("ok", "OK"),
        ("warn", "Warning"),
        ("pause_sim", "Pause simulation"),
        ("block_writes", "Block sim writes"),
        ("cleared", "Safeguards cleared"),
        ("retention_cleanup", "Retention cleanup"),
        ("preflight", "Preflight"),
        ("manual", "Manual"),
    )
    SOURCE_CHOICES = (
        ("cron", "Celery beat"),
        ("manual", "Management command"),
        ("simulator", "Simulator task"),
        ("preflight", "Preflight / admin"),
        ("api", "Admin API"),
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    event_type = models.CharField(max_length=32, choices=EVENT_TYPES, db_index=True)
    used_gb = models.FloatField(null=True, blank=True)
    budget_gb = models.FloatField(null=True, blank=True)
    pct = models.FloatField(null=True, blank=True, help_text="used_gb / budget_gb")
    action_taken = models.CharField(max_length=500)
    source = models.CharField(max_length=64, choices=SOURCE_CHOICES, default="cron")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at", "event_type"]),
        ]
        verbose_name = "Disk audit event"

    def __str__(self):
        pct = f"{self.pct * 100:.0f}%" if self.pct is not None else "—"
        return f"{self.event_type} @ {self.created_at:%Y-%m-%d %H:%M} ({pct})"


# Ensure BetaFeedback model is discovered by Django's model registry.
# Defined in beta_feedback.py with app_label='activities'.
from .beta_feedback import BetaFeedback  # noqa: E402, F401
