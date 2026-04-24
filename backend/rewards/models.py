"""
Rewards & Voucher Marketplace Models (Milestone 4)
====================================================
Constitution §18: Financial and Social Ecosystem

Models:
    Sponsor       — Company providing rewards/vouchers.
    VoucherPool   — Collection of codes for a specific offer.
    Voucher       — Single redeemable code, linked to a user after redemption.
    RewardRule    — Points threshold required to unlock a VoucherPool.
    PointsLedger  — Append-only ledger of user point transactions.
"""
from __future__ import annotations

from django.conf import settings
from django.contrib.gis.db import models
from django.utils.translation import gettext_lazy as _


class Sponsor(models.Model):
    """
    A company or organization that provides rewards for platform participants.
    Linked to a specific tenant (city/corporation) or global.
    """
    name = models.CharField(max_length=200)
    logo_url = models.URLField(blank=True)
    website = models.URLField(blank=True)
    tenant_id = models.CharField(max_length=100, blank=True, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name

    class Meta:
        ordering = ["name"]


class VoucherPool(models.Model):
    """
    A collection of voucher codes for a specific reward offer.
    Each pool is linked to a sponsor and has a limited validity window.
    """
    sponsor = models.ForeignKey(Sponsor, on_delete=models.CASCADE, related_name="pools")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    points_required = models.PositiveIntegerField(
        help_text="Points needed to redeem one voucher from this pool."
    )
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    max_redemptions = models.PositiveIntegerField(
        default=0, help_text="0 = unlimited"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def available_count(self) -> int:
        return self.vouchers.filter(user__isnull=True).count()

    def __str__(self) -> str:
        return f"{self.sponsor.name} — {self.title}"

    class Meta:
        ordering = ["-valid_from"]


class Voucher(models.Model):
    """
    A single redeemable voucher code.
    Is 'unassigned' (user=None) until a user redeems it.
    """
    pool = models.ForeignKey(VoucherPool, on_delete=models.CASCADE, related_name="vouchers")
    code = models.CharField(max_length=64, unique=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vouchers",
    )
    redeemed_at = models.DateTimeField(null=True, blank=True)
    is_used = models.BooleanField(default=False)  # Used at sponsor POS

    def __str__(self) -> str:
        return f"[{self.pool.sponsor.name}] {self.code}"

    class Meta:
        indexes = [models.Index(fields=["user", "is_used"])]


class PointsLedger(models.Model):
    """
    Append-only ledger of user point transactions.
    Never update or delete rows — only append.
    Balance = SUM of all rows for a user.
    """
    REASON_CHOICES = [
        ("ACTIVITY_VERIFIED", _("Activity Verified")),
        ("EVENT_BONUS",       _("Event Bonus")),
        ("VOUCHER_REDEEM",    _("Voucher Redeemed")),
        ("ADMIN_ADJUST",      _("Admin Adjustment")),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="points_ledger",
    )
    delta = models.IntegerField(
        help_text="Positive = earn, Negative = spend"
    )
    reason = models.CharField(max_length=30, choices=REASON_CHOICES)
    reference_id = models.CharField(
        max_length=100, blank=True,
        help_text="Activity ID, Event ID, or Voucher code that triggered this entry."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "created_at"])]

    def __str__(self) -> str:
        return f"{self.user_id} {'+' if self.delta >= 0 else ''}{self.delta} ({self.reason})"
