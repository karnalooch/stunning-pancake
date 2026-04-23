from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = (
        ('OWNER', 'Project Owner'),
        ('GLOBAL_ADMIN', 'Global Administrator'),
        ('LOCAL_MODERATOR', 'Local Moderator'),
        ('ATHLETE', 'End User / Athlete'),
    )
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='ATHLETE')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    
    # B2B association (Tenant ID)
    tenant_id = models.CharField(max_length=100, null=True, blank=True, help_text="ID of the city or company")

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
