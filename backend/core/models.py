from django.db import models


class FeatureFlag(models.Model):
    key = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.key} ({'on' if self.enabled else 'off'})"

    @classmethod
    def is_enabled(cls, key: str) -> bool:
        try:
            return cls.objects.get(key=key).enabled
        except cls.DoesNotExist:
            return True  # Default: enabled
