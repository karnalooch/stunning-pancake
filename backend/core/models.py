from django.db import models


class PlatformNotice(models.Model):
    """Backend-driven in-app incident / campaign communication banner."""

    SEVERITY_CHOICES = [
        ("info", "Info"),
        ("warning", "Warning"),
        ("critical", "Critical"),
    ]

    severity = models.CharField(max_length=16, choices=SEVERITY_CHOICES, default="info")
    title_pl = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    body_pl = models.TextField()
    body_en = models.TextField()
    tenant = models.ForeignKey(
        "users.Tenant",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="platform_notices",
        help_text="Null = global notice for all tenants",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    dismissible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-starts_at"]
        indexes = [
            models.Index(fields=["is_active", "starts_at"]),
            models.Index(fields=["tenant", "is_active"]),
        ]

    def __str__(self) -> str:
        scope = self.tenant_id or "global"
        return f"[{self.severity}] {self.title_en} ({scope})"


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
