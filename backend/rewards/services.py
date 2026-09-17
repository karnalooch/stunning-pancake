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
import secrets
from datetime import timedelta
from typing import TYPE_CHECKING

from django.contrib.auth import get_user_model
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
    @transaction.atomic
    def award_for_activity(cls, activity_id: int) -> int:
        """Award points once for a verified activity, including concurrent retries."""
        from activities.models import Activity
        from rewards.models import PointsLedger

        try:
            activity = Activity.objects.select_related("user").get(pk=activity_id)
        except Activity.DoesNotExist:
            logger.error("award_for_activity: activity_id=%d not found", activity_id)
            return 0

        # Serialize ledger writes per user. The re-check below then makes the
        # existing reference_id contract safe even if two workers run together.
        get_user_model().objects.select_for_update().get(pk=activity.user_id)
        ref = f"activity:{activity_id}"
        if PointsLedger.objects.filter(
            user_id=activity.user_id,
            reason="ACTIVITY_VERIFIED",
            reference_id=ref,
        ).exists():
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
    def redeem_voucher(
        cls,
        user_id: int,
        pool_id: int,
        *,
        idempotency_key: str,
    ) -> Voucher | None:
        """Redeem exactly once for one user/pool/idempotency key.

        A repeated request with the same key returns the originally assigned
        voucher and does not append a second spend ledger row. Locking the user
        also prevents concurrent redemptions in different pools from spending
        the same balance twice.
        """
        from rewards.models import PointsLedger, Voucher, VoucherPool

        key = (idempotency_key or "").strip()
        if not key or len(key) > 64:
            logger.warning("redeem_voucher: invalid idempotency key user=%d", user_id)
            return None

        get_user_model().objects.select_for_update().get(pk=user_id)

        existing = (
            Voucher.objects.select_related("pool")
            .filter(
                pool_id=pool_id,
                user_id=user_id,
                redemption_request_id=key,
            )
            .first()
        )
        if existing:
            return existing

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
        voucher.redemption_request_id = key
        voucher.save(update_fields=["user_id", "redeemed_at", "redemption_request_id"])

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

    @classmethod
    def create_voucher_pool(
        cls,
        sponsor,
        *,
        title: str,
        points_required: int,
        description: str = "",
        quantity: int = 10,
        valid_days: int = 90,
    ):
        """
        Create a voucher pool and generate unassigned voucher codes for sponsors.
        """
        from rewards.models import Voucher, VoucherPool

        qty = max(1, min(int(quantity), 500))
        days = max(1, min(int(valid_days), 365))
        now = timezone.now()
        pool = VoucherPool.objects.create(
            sponsor=sponsor,
            title=title.strip(),
            description=(description or "").strip(),
            points_required=max(1, int(points_required)),
            valid_from=now,
            valid_until=now + timedelta(days=days),
        )
        Voucher.objects.bulk_create(
            [Voucher(pool=pool, code=secrets.token_hex(6).upper()) for _ in range(qty)],
            batch_size=50,
        )
        logger.info(
            "rewards.pool_created sponsor=%s pool=%d quantity=%d",
            sponsor.pk,
            pool.pk,
            qty,
        )
        return pool
