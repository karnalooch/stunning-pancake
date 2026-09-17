import base64
import hashlib
import logging
import os

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.contrib.gis.db import models

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
        ("WALK", "Nordic Walking"),
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

    # Client-generated request identity for crash-safe/retry-safe first-party session starts.
    # It is nullable so historical/wearable activities do not need a synthetic value.
    client_request_id = models.CharField(max_length=64, null=True, blank=True)

    # Anti-cheat status
    is_verified = models.BooleanField(default=False)
    verification_score = models.FloatField(default=0.0)

    REJECTION_REASONS = (
        ("GPS_SPOOF", "GPS spoofing suspected"),
        ("DISTANCE_MISMATCH", "Distance mismatch"),
        ("DUPLICATE", "Duplicate activity"),
        ("OTHER", "Other"),
    )

    moderated_at = models.DateTimeField(null=True, blank=True)
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderated_activities",
    )
    moderation_assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_moderation_activities",
    )
    rejection_reason = models.CharField(
        max_length=32, choices=REJECTION_REASONS, blank=True, default=""
    )
    rejection_notes = models.TextField(blank=True, default="")

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

    # GPX archive (P2 F2)
    gpx_storage_key = models.CharField(max_length=512, blank=True, default="")
    gpx_sha256 = models.CharField(max_length=64, blank=True, default="")
    gpx_generated_at = models.DateTimeField(null=True, blank=True)
    route_fingerprint = models.CharField(max_length=64, blank=True, default="", db_index=True)
    gpx_forensics_flags = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name_plural = "Activities"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "external_source", "external_id"],
                condition=models.Q(external_id__isnull=False) & ~models.Q(external_id=""),
                name="activities_activity_user_external_unique",
            ),
            models.UniqueConstraint(
                fields=["user", "client_request_id"],
                condition=models.Q(client_request_id__isnull=False) & ~models.Q(client_request_id=""),
                name="activities_activity_user_client_request_unique",
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
    sponsor = models.ForeignKey(
        "rewards.Sponsor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pois",
    )
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.name} ({self.tenant.name if self.tenant else 'No Tenant'})"


class Voucher(models.Model):
    """
    Legacy voucher model used by POI proximity reward flow.
    """

    sponsor = models.ForeignKey("rewards.Sponsor", on_delete=models.CASCADE)
    code = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.code


class WearableIntegration(models.Model):
    SERVICES = (("STRAVA", "Strava"), ("GARMIN", "Garmin"))

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wearables"
    )
    service = models.CharField(max_length=20, choices=SERVICES)
    access_token_encrypted = models.BinaryField()
    refresh_token_encrypted = models.BinaryField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "service")

    def set_access_token(self, token: str) -> None:
        self.access_token_encrypted = _fernet.encrypt(token.encode())

    def get_access_token(self) -> str:
        try:
            return _fernet.decrypt(bytes(self.access_token_encrypted)).decode()
        except (InvalidToken, TypeError, ValueError) as exc:
            logger.warning("Unable to decrypt wearable access token for integration %s", self.pk)
            raise ValueError("Unable to decrypt wearable access token") from exc

    def set_refresh_token(self, token: str | None) -> None:
        self.refresh_token_encrypted = _fernet.encrypt(token.encode()) if token else None

    def get_refresh_token(self) -> str | None:
        if not self.refresh_token_encrypted:
            return None
        try:
            return _fernet.decrypt(bytes(self.refresh_token_encrypted)).decode()
        except (InvalidToken, TypeError, ValueError) as exc:
            logger.warning("Unable to decrypt wearable refresh token for integration %s", self.pk)
            raise ValueError("Unable to decrypt wearable refresh token") from exc

    def __str__(self):
        return f"{self.user_id}:{self.service}"


class BetaFeedback(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="beta_feedback",
    )
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, default="")
    context = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_id}:{self.rating}"
