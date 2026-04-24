from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = (
        ('GLOBAL_ADMIN', 'Superuser / Global Admin'),
        ('LOCAL_ADMIN', 'Tenant Admin / Coordinator'),
        ('MODERATOR', 'Moderator / Support'),
        ('USER', 'Athlete / User'),
    )
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='USER')
    is_premium = models.BooleanField(default=False)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    
    # B2B association (Tenant ID)
    tenant_id = models.CharField(max_length=100, null=True, blank=True, help_text="ID of the city or company")

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

class TenantProfile(models.Model):
    """
    White-Label configuration for B2B tenants (cities, companies).
    """
    tenant_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    
    # Branding
    logo = models.ImageField(upload_to='tenants/logos/', null=True, blank=True)
    primary_color = models.CharField(max_length=7, default='#00d2ff')
    secondary_color = models.CharField(max_length=7, default='#92fe9d')
    
    # Configuration
    is_active = models.BooleanField(default=True)
    max_users = models.IntegerField(default=1000)

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
    # Example config_json:
    # {
    #   "normalization_factor": 1.2,
    #   "require_brouter": true,
    #   "allowed_sports": ["RUN", "BIKE"],
    #   "fcm_server_key": "...",
    # }

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

