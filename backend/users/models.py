import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models

class Role(models.TextChoices):
    GLOBAL_OWNER = 'GLOBAL_OWNER', 'Global Owner'
    TENANT_ADMIN = 'TENANT_ADMIN', 'Tenant Admin / Owner'
    TENANT_MODERATOR = 'TENANT_MODERATOR', 'Moderator'
    ATHLETE = 'ATHLETE', 'Athlete'
    SPONSOR = 'SPONSOR', 'Sponsor'

class Tenant(models.Model):
    """
    White-Label configuration for B2B tenants (cities, companies).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    
    # Branding
    logo = models.ImageField(upload_to='tenants/logos/', null=True, blank=True)
    primary_color = models.CharField(max_length=7, default='#00d2ff')
    secondary_color = models.CharField(max_length=7, default='#92fe9d')
    
    # Configuration & Feature Toggles
    is_active = models.BooleanField(default=True)
    max_users = models.IntegerField(default=1000)
    has_heatmap_analytics = models.BooleanField(default=False, help_text="Feature toggle for advanced heatmap analytics")
    
    # Phase 8: White-Label and per-tenant normalization rules
    white_label_domain = models.CharField(
        max_length=200, blank=True,
        help_text='Custom domain for white-label deployments (e.g. wellness.acme.com)'
    )
    config_json = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            'Per-tenant configuration: brouter_validation, normalization_factor, '
            'allowed_sports, push_notification_key, etc.'
        ),
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class User(AbstractUser):
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ATHLETE)
    tenant = models.ForeignKey(Tenant, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    
    is_premium = models.BooleanField(default=False)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(max_length=500, blank=True)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
