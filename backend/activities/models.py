from django.contrib.gis.db import models
from django.conf import settings

class Activity(models.Model):
    ACTIVITY_TYPES = (
        ('RUN', 'Running'),
        ('BIKE', 'Cycling'),
        ('WALK', 'Walking'),
        ('WHEELCHAIR', 'Wheelchair'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_back='activities')
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
        ]

    def __str__(self):
        return f"{self.user.username} - {self.type} - {self.start_time.date()}"

class PrivacyZone(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    center = models.PointField(srid=4326)
    radius = models.FloatField(help_text="Radius in meters")
    label = models.CharField(max_length=100, default="Home")

    def __str__(self):
        return f"{self.user.username} Privacy Zone: {self.label}"
