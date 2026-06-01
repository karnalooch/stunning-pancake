"""
Idempotent leaderboard + event progress credit for verified activities.
"""
from __future__ import annotations

import logging

from activities.models import Activity

logger = logging.getLogger(__name__)

_CREDIT_KEY_PREFIX = "leaderboard:credited:"
_CREDIT_TTL_S = 60 * 60 * 24 * 90  # 90 days


def credit_verified_activity(activity: Activity) -> bool:
    """
    Idempotently add activity km to city Redis leaderboard and event progress.

    Uses Redis SET NX so concurrent Celery workers or duplicate signals
    cannot double-credit the same activity.

    Returns True if this call newly credited the activity.
    """
    if not activity.is_verified:
        return False

    from core.redis_cluster import get_redis

    lock_key = f"{_CREDIT_KEY_PREFIX}{activity.id}"
    try:
        r = get_redis()
        if not r.set(lock_key, "1", nx=True, ex=_CREDIT_TTL_S):
            return False
    except Exception as exc:
        logger.warning(
            "leaderboard_credit.lock_failed activity_id=%s err=%s",
            activity.id,
            exc,
        )
        return False

    km = activity.distance / 1000.0
    user = activity.user
    tenant_id = getattr(user, "tenant_id", None) or (
        activity.tenant_id if activity.tenant_id else None
    )

    if tenant_id:
        from activities.leaderboards import LeaderboardService

        LeaderboardService.update_score(user.id, tenant_id, km)

    try:
        from core.plugin_registry import registry

        registry.fire("activity.verified", activity=activity)
    except Exception as exc:
        logger.warning(
            "leaderboard_credit.plugin_failed activity_id=%s err=%s",
            activity.id,
            exc,
        )

    try:
        from events.services import EventProgressService

        EventProgressService.record_activity(
            user=user,
            km=km,
            tenant_id=tenant_id,
            activity_id=activity.id,
        )
    except Exception as exc:
        logger.warning(
            "leaderboard_credit.event_failed activity_id=%s err=%s",
            activity.id,
            exc,
        )

    try:
        from rewards.services import RewardsService

        points = RewardsService.award_for_activity(activity.id)
        if points:
            logger.info(
                "rewards.awarded activity_id=%d points=%d",
                activity.id,
                points,
            )
    except Exception as exc:
        logger.error(
            "leaderboard_credit.rewards_failed activity_id=%s err=%s",
            activity.id,
            exc,
        )

    return True
