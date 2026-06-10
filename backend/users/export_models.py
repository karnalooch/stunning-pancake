"""RODO data export job tracking (P2 F5)."""

from django.conf import settings
from django.db import models
from django.utils import timezone


class UserDataExport(models.Model):
    STATUS_PENDING = "pending"
    STATUS_READY = "ready"
    STATUS_FAILED = "failed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="data_exports",
    )
    job_id = models.CharField(max_length=32, unique=True, db_index=True)
    status = models.CharField(max_length=20, default=STATUS_PENDING)
    storage_uri = models.CharField(max_length=512, blank=True, default="")
    download_key = models.CharField(max_length=512, blank=True, default="")
    activity_count = models.IntegerField(default=0)
    expires_at = models.DateTimeField()
    error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at
