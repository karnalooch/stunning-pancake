from django.conf import settings
from django.contrib.gis.db import models


class Activity(models.Model):
    ACTIVITY_TYPES = (
        ('RUN', 'Running'),
        ('BIKE', 'Cycling'),
        ('WALK', 'Walking'),
        ('WHEELCHAIR', 'Wheelchair'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='activities')
    tenant = models.ForeignKey('users.Tenant', on_delete=models.CASCADE, related_name='activities', null=True, blank=True)
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

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Activities"
        indexes = [
            models.Index(fields=['user', 'start_time']),
            models.Index(fields=['type', 'is_verified']),
            models.Index(fields=['created_at']),
            models.Index(fields=['tenant', 'is_verified']),
            models.Index(fields=['tenant', 'created_at']),
            models.Index(fields=['user', 'tenant']),
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
        ('COFFEE', 'Coffee Shop'),
        ('SHOP', 'Retail Store'),
        ('BIKE', 'Bike Shop/Service'),
        ('OTHER', 'Other'),
    )

    name = models.CharField(max_length=200)
    location = models.PointField(srid=4326)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='OTHER')
    tenant = models.ForeignKey('users.Tenant', on_delete=models.CASCADE, related_name='pois', null=True, blank=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.name} ({self.tenant.name if self.tenant else 'No Tenant'})"

class Voucher(models.Model):
    """
    Redeemable reward linked to a POI.
    """
    poi = models.ForeignKey(POI, on_delete=models.CASCADE, related_name='vouchers')
    code = models.CharField(max_length=50, unique=True)
    discount_value = models.CharField(max_length=100)
    is_redeemed = models.BooleanField(default=False)
    redeemed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    expiry_date = models.DateTimeField()

    def __str__(self):
        return f"{self.code} - {self.poi.name}"

class WearableIntegration(models.Model):
    """
    Stores OAuth credentials for external wearable services (Milestone 4).
    """
    SERVICE_CHOICES = (
        ('STRAVA', 'Strava'),
        ('GARMIN', 'Garmin'),
        ('APPLE', 'Apple HealthKit'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wearables')
    service = models.CharField(max_length=20, choices=SERVICE_CHOICES)

    # OAuth 2.0
    access_token = models.TextField()
    refresh_token = models.TextField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    # External ID
    external_id = models.CharField(max_length=200, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    last_sync = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'service')

    def __str__(self):
        return f"{self.user.username} - {self.service}"

