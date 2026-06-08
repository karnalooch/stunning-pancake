"""
Rewards Service Layer (Milestone 4)
=====================================
Constitution §18: Financial and Social Ecosystem

Handles:
- Points award logic (activity verification → points).
- Atomic voucher redemption with race-condition protection.
- User balance calculation from PointsLedger.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.db import transaction

if TYPE_CHECKING:
    from rewards.models import Voucher
from django.utils import timezone

logger = logging.getLogger(__name__)

# Points per verified kilometre (configurable via TenantConfig in Milestone 5)
POINTS_PER_KM = 10


class RewardsService:
    """Business logic for the points and voucher system."""

    @classmethod
    def get_balance(cls, user_id: int) -> int:
        """
        Returns current point balance for a user by summing the ledger.

        Args:
            user_id: Django User primary key.

        Returns:
            Total points balance (can be negative on admin corrections).
        """
        from django.db.models import Sum

        from rewards.models import PointsLedger

        total = PointsLedger.objects.filter(user_id=user_id).aggregate(total=Sum("delta"))["total"]
        return total or 0

    @classmethod
    def award_for_activity(cls, activity_id: int) -> int:
        """
        Awards points for a newly verified activity.
        Points = floor(distance_km * POINTS_PER_KM).

        Idempotent: will not award points twice for the same activity.

        Args:
            activity_id: Activity primary key.

        Returns:
            Points awarded (0 if already credited).
        """
        from activities.models import Activity
        from rewards.models import PointsLedger

        try:
            activity = Activity.objects.select_related("user").get(pk=activity_id)
        except Activity.DoesNotExist:
            logger.error("award_for_activity: activity_id=%d not found", activity_id)
            return 0

        ref = f"activity:{activity_id}"
        if PointsLedger.objects.filter(reference_id=ref).exists():
            logger.debug("award_for_activity: already credited activity_id=%d", activity_id)
            return 0

        distance_km = (activity.distance or 0) / 1000
        points = int(distance_km * POINTS_PER_KM)
        if points <= 0:
            return 0

        PointsLedger.objects.create(
            user=activity.user,
            delta=points,
            reason="ACTIVITY_VERIFIED",
            reference_id=ref,
        )
        logger.info(
            "rewards.awarded user=%d activity=%d points=%d",
            activity.user_id,
            activity_id,
            points,
        )
        return points

    @classmethod
    @transaction.atomic
    def redeem_voucher(cls, user_id: int, pool_id: int) -> Voucher | None:
        """
        Atomically redeems one voucher from a pool for the user.

        Uses SELECT FOR UPDATE to prevent double-redemption under load.

        Args:
            user_id: Django User primary key.
            pool_id: VoucherPool primary key.

        Returns:
            The redeemed Voucher instance, or None on failure.
        """
        from rewards.models import PointsLedger, Voucher, VoucherPool

        try:
            pool = VoucherPool.objects.get(pk=pool_id)
        except VoucherPool.DoesNotExist:
            logger.error("redeem_voucher: pool_id=%d not found", pool_id)
            return None

        now = timezone.now()
        if not (pool.valid_from <= now <= pool.valid_until):
            logger.warning("redeem_voucher: pool_id=%d outside validity window", pool_id)
            return None

        balance = cls.get_balance(user_id)
        if balance < pool.points_required:
            logger.warning(
                "redeem_voucher: insufficient points user=%d balance=%d required=%d",
                user_id,
                balance,
                pool.points_required,
            )
            return None

        # Claim an unassigned voucher — SELECT FOR UPDATE prevents race conditions
        voucher = (
            Voucher.objects.select_for_update(skip_locked=True)
            .filter(pool=pool, user__isnull=True)
            .first()
        )
        if not voucher:
            logger.warning("redeem_voucher: pool_id=%d exhausted", pool_id)
            return None

        voucher.user_id = user_id
        voucher.redeemed_at = now
        voucher.save(update_fields=["user_id", "redeemed_at"])

        PointsLedger.objects.create(
            user_id=user_id,
            delta=-pool.points_required,
            reason="VOUCHER_REDEEM",
            reference_id=voucher.code,
        )

        logger.info(
            "rewards.redeemed user=%d pool=%d code=%s points_spent=%d",
            user_id,
            pool_id,
            voucher.code,
            pool.points_required,
        )
        return voucher
