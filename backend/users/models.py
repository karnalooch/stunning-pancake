import uuid

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


class Role(models.TextChoices):
    GLOBAL_OWNER = "GLOBAL_OWNER", "Global Owner"
    TENANT_ADMIN = "TENANT_ADMIN", "Tenant Admin / Owner"
    TENANT_MODERATOR = "TENANT_MODERATOR", "Moderator"
    ATHLETE = "ATHLETE", "Athlete"
    SPONSOR = "SPONSOR", "Sponsor"


class Tenant(models.Model):
    """
    White-Label configuration for B2B tenants (cities, companies).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)

    # Branding
    logo = models.ImageField(upload_to="tenants/logos/", null=True, blank=True)
    primary_color = models.CharField(max_length=7, default="#00d2ff")
    secondary_color = models.CharField(max_length=7, default="#92fe9d")

    # Configuration & Feature Toggles
    is_active = models.BooleanField(default=True)
    max_users = models.IntegerField(default=1000)
    has_heatmap_analytics = models.BooleanField(
        default=False, help_text="Feature toggle for advanced heatmap analytics"
    )

    # Stripe Integration (Milestone 4)
    stripe_account_id = models.CharField(
        max_length=100, null=True, blank=True, help_text="Connected account ID for sponsor payouts"
    )

    # Phase 8: White-Label and per-tenant normalization rules
    white_label_domain = models.CharField(
        max_length=200,
        blank=True,
        help_text="Custom domain for white-label deployments (e.g. wellness.acme.com)",
    )
    config_json = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Per-tenant configuration: brouter_validation, normalization_factor, "
            "allowed_sports, push_notification_key, etc."
        ),
    )
    map_theme = models.JSONField(
        default=dict,
        blank=True,
        help_text="Live Map cluster/hub palette overrides (white-label)",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class User(AbstractUser):
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ATHLETE)
    tenant = models.ForeignKey(
        Tenant, on_delete=models.SET_NULL, null=True, blank=True, related_name="users"
    )

    is_premium = models.BooleanField(default=False)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    bio = models.TextField(max_length=500, blank=True)

    # Stripe (Milestone 4)
    stripe_customer_id = models.CharField(max_length=100, null=True, blank=True)
    stripe_connect_id = models.CharField(max_length=100, null=True, blank=True)

    # MFA (P2 Auth — TOTP)
    mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.CharField(max_length=64, blank=True, default="")
    mfa_secret_pending = models.CharField(max_length=64, blank=True, default="")

    preferences = models.JSONField(
        default=dict,
        blank=True,
        help_text="User UI preferences: notifications, language, dashboard widgets, etc.",
    )

    # Department hierarchy
    departments = models.ManyToManyField(
        "users.Department",
        through="users.UserDepartment",
        blank=True,
        related_name="members",
        help_text="Departments this user belongs to",
    )

    def get_permissions(self, tenant_id=None):
        """Returns set of permission codenames for this user, optionally scoped to a tenant."""
        qs = UserRole.objects.filter(user=self)
        if tenant_id:
            qs = qs.filter(models.Q(tenant_id=tenant_id) | models.Q(tenant__isnull=True))
        else:
            qs = qs.filter(tenant__isnull=True)
        perms = set()
        for ur in qs.select_related("role").prefetch_related("role__permissions"):
            for perm in ur.role.permissions.all():
                perms.add(perm.codename)
        return perms

    def has_perm(self, perm_codename, tenant_id=None):
        """Check if user has a specific permission."""
        return perm_codename in self.get_permissions(tenant_id)

    def has_role(self, role_slug, tenant_id=None):
        """Check if user has a specific role."""
        qs = UserRole.objects.filter(user=self, role__slug=role_slug)
        if tenant_id:
            qs = qs.filter(models.Q(tenant_id=tenant_id) | models.Q(tenant__isnull=True))
        return qs.exists()

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class UserPushToken(models.Model):
    """Device push token registry for Expo delivery."""

    PLATFORM_CHOICES = (
        ("android", "Android"),
        ("ios", "iOS"),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="push_tokens",
    )
    token = models.CharField(max_length=255, unique=True, db_index=True)
    platform = models.CharField(max_length=16, choices=PLATFORM_CHOICES)
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user.username}:{self.platform}:{self.token[:16]}"


AUDIT_LOG_IMMUTABLE_MESSAGE = (
    "Audit logs are append-only and cannot be modified or deleted."
)
_AUDIT_LOG_FK_NULL_FIELDS = {
    "impersonator",
    "impersonator_id",
    "target_user",
    "target_user_id",
}


class AuditLogQuerySet(models.QuerySet):
    """Default ORM surface for audit rows: insert/read only.

    QuerySet ``update``/``delete`` would otherwise bypass model ``save``/``delete``
    hooks, so they are denied explicitly. The only ordinary lifecycle mutation
    accepted here is Django's ``SET_NULL`` update when a referenced user is
    deleted; immutable identity snapshots keep the original attribution.
    Narrow synthetic recovery-fixture maintenance is exposed only through
    ``AuditLogManager`` below.
    """

    def update(self, **kwargs):
        if kwargs and set(kwargs).issubset(_AUDIT_LOG_FK_NULL_FIELDS) and all(
            value is None for value in kwargs.values()
        ):
            return super().update(**kwargs)
        raise ValidationError(AUDIT_LOG_IMMUTABLE_MESSAGE)

    def delete(self):
        raise ValidationError(AUDIT_LOG_IMMUTABLE_MESSAGE)

    def bulk_update(self, objs, fields, batch_size=None):
        raise ValidationError(AUDIT_LOG_IMMUTABLE_MESSAGE)


class AuditLogManager(models.Manager.from_queryset(AuditLogQuerySet)):
    """Append-only manager with a deliberately narrow synthetic-fixture bypass.

    The P3 backup/restore drill has to reseed deterministic synthetic rows and
    timestamps. Keep that exception scoped to ``P3_RECOVERY_`` rows instead of
    exposing a general mutation escape hatch to runtime code.
    """

    RECOVERY_FIXTURE_PREFIX = "P3_RECOVERY_"

    def purge_recovery_fixture(self):
        qs = super().get_queryset().filter(
            action__startswith=self.RECOVERY_FIXTURE_PREFIX
        )
        return models.QuerySet.delete(qs)

    def set_recovery_fixture_timestamp(self, *, pk, timestamp):
        qs = super().get_queryset().filter(
            pk=pk,
            action__startswith=self.RECOVERY_FIXTURE_PREFIX,
        )
        if not qs.exists():
            raise ValidationError(
                "Audit-log maintenance is limited to P3 recovery fixtures."
            )
        return models.QuerySet.update(qs, timestamp=timestamp)


class AuditLog(models.Model):
    """
    Logs sensitive actions, specifically those taken during impersonation sessions
    and admin-level mutating operations.

    Uses ForeignKey to User for referential integrity and ORM join capabilities.
    Immutable identity snapshots preserve attribution when a referenced user is
    later deleted and the live ForeignKey is set to NULL.
    Includes tenant_id for multi-tenant audit log filtering.

    T70 contract: rows are append-only through the normal Django ORM/admin API.
    The only ORM mutation bypass is the narrow P3 synthetic recovery-fixture
    helper on ``AuditLog.objects``. Deliberate low-level maintenance paths such
    as the owner-approved destructive simulator wipe remain explicit exceptions
    and are not exposed through normal CRUD surfaces.
    """

    impersonator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=False,
        related_name="audit_logs_as_impersonator",
        help_text="The GLOBAL_OWNER who initiated the impersonation (or the admin who performed the action)",
    )
    target_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=False,
        related_name="audit_logs_as_target",
        help_text="The user who was impersonated (or the admin themself for non-impersonated actions)",
    )
    impersonator_id_snapshot = models.BigIntegerField(
        null=True, blank=True, editable=False
    )
    target_user_id_snapshot = models.BigIntegerField(
        null=True, blank=True, editable=False
    )
    impersonator_username_snapshot = models.CharField(
        max_length=150, null=True, blank=True, editable=False
    )
    target_user_username_snapshot = models.CharField(
        max_length=150, null=True, blank=True, editable=False
    )
    tenant_id = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Tenant context at the time of the action (denormalized for multi-tenant filtering)",
    )
    action = models.CharField(max_length=255)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    status_code = models.IntegerField()
    timestamp = models.DateTimeField(auto_now_add=True)

    objects = AuditLogManager()

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError(AUDIT_LOG_IMMUTABLE_MESSAGE)
        if self.impersonator_id is not None:
            self.impersonator_id_snapshot = self.impersonator_id
            if self.impersonator is not None:
                self.impersonator_username_snapshot = self.impersonator.username
        if self.target_user_id is not None:
            self.target_user_id_snapshot = self.target_user_id
            if self.target_user is not None:
                self.target_user_username_snapshot = self.target_user.username
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError(AUDIT_LOG_IMMUTABLE_MESSAGE)

    def __str__(self):
        impersonator_name = (
            self.impersonator.username
            if self.impersonator
            else self.impersonator_username_snapshot or "N/A"
        )
        target_name = (
            self.target_user.username
            if self.target_user
            else self.target_user_username_snapshot or "N/A"
        )
        return f"Audit: {impersonator_name} → {target_name} - {self.action}"


# Import other models in this app at the bottom to ensure they are registered with Django's app registry.
from .departments import Department, UserDepartment  # noqa: E402, F401
from .export_models import UserDataExport  # noqa: E402, F401
from .rbac_models import Role, UserRole  # noqa: E402, F401
