"""
Celery Async Tasks — Activities App
=====================================
Constitution §9.2: Asynchronous Processing & Task Queues
Milestone 2: Async city leaderboard recalculation

Moves heavy BRouter validation + GPS signal processing off the
Django request/signal thread into the 'critical' Celery queue.

Workers: `celery -A core worker -Q critical,notifications -l info --concurrency=4`
"""
from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    queue="critical",
    max_retries=3,
    default_retry_delay=30,
    name="activities.tasks.process_activity",
)
def process_activity_async(self, activity_id: int) -> dict:
    """
    Full async pipeline for a completed activity:
    1. Load activity from DB.
    2. Apply Privacy masking.
    3. Kalman filter + V-max kinematic analysis.
    4. BRouter topological validation.
    5. Viterbi Map Matching.
    6. Update verification status + leaderboards.
    7. Fire plugin hooks (Voucher, Suspicious alert).
    8. Update Event progress.

    Args:
        activity_id: Primary key of the Activity to process.

    Returns:
        Dict with processing results.
    """
    from activities.models import Activity
    from activities.services import BRouterService, PrivacyService
    from activities.leaderboards import LeaderboardService
    from activities.signal_processing import GpsPoint, process_gps_track
    from django.contrib.gis.geos import LineString

    try:
        activity = Activity.objects.select_related('user').get(pk=activity_id)
    except Activity.DoesNotExist:
        logger.error("process_activity_async: activity_id=%d not found", activity_id)
        return {"status": "error", "reason": "not_found"}

    if activity.is_verified or not activity.route_path or not activity.end_time:
        return {"status": "skipped", "reason": "already_processed_or_incomplete"}

    # --- Step 1: Privacy masking ---
    masked_path = PrivacyService.mask_track(activity.user, activity.route_path)
    if not masked_path:
        logger.info("activity.masked_empty activity_id=%d", activity_id)
        return {"status": "skipped", "reason": "masked_empty"}

    coords = list(masked_path.coords)

    # --- Step 2: BRouter validation ---
    brouter_result = BRouterService.validate_track(activity.type, coords)

    # --- Step 3: GPS signal processing (Kalman → V-max → Viterbi) ---
    raw_points = [
        GpsPoint(lat=c[1], lon=c[0], timestamp=float(i))
        for i, c in enumerate(coords)
    ]
    processing = process_gps_track(
        raw_points=raw_points,
        activity_type=activity.type,
        brouter_result=brouter_result,
    )

    # Rebuild route_path from Viterbi-matched points
    if len(processing.matched_points) >= 2:
        matched_coords = [(p.lon, p.lat) for p in processing.matched_points]
        activity.route_path = LineString(matched_coords, srid=4326)

    # --- Step 4: Verification scoring ---
    is_verified = False
    verification_score = 0.0

    if brouter_result.get("success"):
        b_dist = float(brouter_result["brouter_distance"])
        gps_dist = processing.total_distance_m

        if gps_dist > 0:
            ratio = abs(b_dist - gps_dist) / gps_dist
            verification_score = 1.0 - ratio
            is_verified = ratio < 0.15 and not processing.is_suspicious

    # --- Step 5: Persist results ---
    Activity.objects.filter(pk=activity_id).update(
        is_verified=is_verified,
        verification_score=verification_score,
        route_path=activity.route_path,
    )

    if is_verified:
        # Update city leaderboard (immediate ZINCRBY; batch recalc runs separately)
        if activity.user.tenant_id:
            LeaderboardService.update_score(
                activity.user.id,
                activity.user.tenant_id,
                activity.distance / 1000.0,
            )

        # Update Event progress
        try:
            from events.services import EventProgressService
            membership = activity.user.club_memberships.filter(status='ACTIVE').first()
            EventProgressService.record_activity(
                user=activity.user,
                km=activity.distance / 1000.0,
                tenant_id=activity.user.tenant_id,
                club_id=membership.club_id if membership else None,
            )
        except Exception as exc:
            logger.warning("event_progress_update_failed activity_id=%d err=%s", activity_id, exc)

        # Fire plugin hooks
        try:
            from core.plugin_registry import registry
            registry.fire('activity.verified', activity=activity)
        except Exception as exc:
            logger.warning("plugin_hook_failed activity_id=%d err=%s", activity_id, exc)

    else:
        # Fire suspicious hook (Matrix alert, admin flag, etc.)
        try:
            from core.plugin_registry import registry
            registry.fire(
                'activity.suspicious',
                activity=activity,
                anomaly_ratio=processing.anomaly_ratio,
            )
        except Exception as exc:
            logger.warning("suspicious_hook_failed activity_id=%d err=%s", activity_id, exc)

        # Also direct Matrix alert for admin room
        try:
            from core.matrix_provisioner import MatrixProvisioner
            MatrixProvisioner.send_notification(
                "!admin_room_id:matrix.org",
                f"🚨 Suspicious activity #{activity_id} by {activity.user.username}. "
                f"Ratio: {processing.anomaly_ratio:.0%}. "
                f"Consecutive: {processing.max_consecutive}. "
                f"Reason: {processing.suspicious_reason}.",
            )
        except Exception as exc:
            logger.warning("matrix_alert_failed activity_id=%d err=%s", activity_id, exc)

    logger.info(
        "process_activity_async.done activity_id=%d verified=%s score=%.3f "
        "anomaly_ratio=%.2f consecutive=%d",
        activity_id, is_verified, verification_score,
        processing.anomaly_ratio, processing.max_consecutive,
    )
    return {
        "status": "done",
        "activity_id": activity_id,
        "is_verified": is_verified,
        "verification_score": round(verification_score, 4),
        "anomaly_ratio": round(processing.anomaly_ratio, 4),
        "max_consecutive": processing.max_consecutive,
        "suspicious_reason": processing.suspicious_reason,
        "distance_m": round(processing.total_distance_m, 2),
    }


@shared_task(
    queue="notifications",
    name="activities.tasks.send_leaderboard_digest",
    ignore_result=True,
)
def send_leaderboard_digest(city_id: str, top_n: int = 10) -> None:
    """
    Sends a weekly leaderboard digest to the city's Matrix room.

    Args:
        city_id: Tenant ID (city/company).
        top_n: Number of top athletes to include.
    """
    from activities.leaderboards import LeaderboardService
    from core.matrix_provisioner import MatrixProvisioner

    top = LeaderboardService.get_top_users(city_id, limit=top_n)
    if not top:
        return

    lines = [f"🏆 Tygodniowy ranking — {city_id}:\n"]
    for idx, entry in enumerate(top, 1):
        lines.append(f"{idx}. User #{entry['user_id']} — {entry['score']:.1f} km")

    message = "\n".join(lines)
    MatrixProvisioner.send_notification(f"!city_{city_id}:matrix.org", message)
    logger.info("leaderboard_digest.sent city_id=%s top_n=%d", city_id, len(top))


@shared_task(
    queue="default",
    name="activities.tasks.recalculate_city_leaderboard",
    ignore_result=True,
)
def recalculate_city_leaderboard(city_id: str) -> None:
    """
    Batch-recalculates a city leaderboard by aggregating all verified
    activities from the DB and pushing to Redis in a single pipeline.

    Runs every 5 minutes via Celery Beat for active cities.
    Handles 200+ concurrent activity finishes without data loss.

    Args:
        city_id: Tenant ID to recalculate.
    """
    from django.db.models import Sum
    from activities.models import Activity
    from activities.leaderboards import LeaderboardService

    try:
        # Aggregate total km per user from verified activities in this city
        qs = (
            Activity.objects
            .filter(is_verified=True, user__tenant_id=city_id)
            .values("user_id")
            .annotate(total_km=Sum("distance"))
        )
        scores: dict[int, float] = {
            row["user_id"]: round((row["total_km"] or 0) / 1000.0, 3)
            for row in qs
        }

        if not scores:
            logger.info("recalculate_city_leaderboard: no data for city_id=%s", city_id)
            return

        # Single Redis pipeline — O(N) atomic replace
        LeaderboardService.batch_recalculate(city_id, scores, scope="city")
        logger.info(
            "recalculate_city_leaderboard.done city_id=%s users=%d",
            city_id, len(scores),
        )

    except Exception as exc:
        logger.error(
            "recalculate_city_leaderboard.error city_id=%s err=%s",
            city_id, exc, exc_info=True,
        )

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    queue="critical",
    max_retries=3,
    default_retry_delay=30,
    name="activities.tasks.process_activity",
)
def process_activity_async(self, activity_id: int) -> dict:
    """
    Full async pipeline for a completed activity:
    1. Load activity from DB.
    2. Apply Privacy masking.
    3. Run Kalman filter + Kinematic anomaly detection.
    4. BRouter topological validation.
    5. Viterbi Map Matching.
    6. Update verification status + leaderboards.
    7. Fire plugin hooks (Voucher, etc.)
    8. Update Event progress.

    This task replaces the synchronous Django signal handler for
    production environments where latency matters.

    Args:
        activity_id: Primary key of the Activity to process.

    Returns:
        Dict with processing results.
    """
    from activities.models import Activity
    from activities.services import BRouterService, PrivacyService
    from activities.leaderboards import LeaderboardService
    from activities.signal_processing import GpsPoint, process_gps_track
    from django.contrib.gis.geos import LineString

    try:
        activity = Activity.objects.select_related('user').get(pk=activity_id)
    except Activity.DoesNotExist:
        logger.error("process_activity_async: activity_id=%d not found", activity_id)
        return {"status": "error", "reason": "not_found"}

    if activity.is_verified or not activity.route_path or not activity.end_time:
        return {"status": "skipped", "reason": "already_processed_or_incomplete"}

    # --- Step 1: Privacy masking ---
    masked_path = PrivacyService.mask_track(activity.user, activity.route_path)
    if not masked_path:
        logger.info("activity.masked_empty activity_id=%d", activity_id)
        return {"status": "skipped", "reason": "masked_empty"}

    coords = list(masked_path.coords)

    # --- Step 2: BRouter validation ---
    brouter_result = BRouterService.validate_track(activity.type, coords)

    # --- Step 3: GPS signal processing (Kalman + Viterbi) ---
    raw_points = [
        GpsPoint(lat=c[1], lon=c[0], timestamp=float(i))
        for i, c in enumerate(coords)
    ]
    processing = process_gps_track(
        raw_points=raw_points,
        activity_type=activity.type,
        brouter_result=brouter_result,
    )

    # Rebuild route_path from matched points
    if len(processing.matched_points) >= 2:
        matched_coords = [(p.lon, p.lat) for p in processing.matched_points]
        activity.route_path = LineString(matched_coords, srid=4326)

    # --- Step 4: Verification scoring ---
    is_verified = False
    verification_score = 0.0

    if brouter_result.get("success"):
        b_dist = float(brouter_result["brouter_distance"])
        gps_dist = processing.total_distance_m

        if gps_dist > 0:
            ratio = abs(b_dist - gps_dist) / gps_dist
            verification_score = 1.0 - ratio
            is_verified = ratio < 0.15 and not processing.is_suspicious

    # --- Step 5: Persist results ---
    Activity.objects.filter(pk=activity_id).update(
        is_verified=is_verified,
        verification_score=verification_score,
        route_path=activity.route_path,
    )

    if is_verified:
        # Update leaderboard
        if activity.user.tenant_id:
            LeaderboardService.update_score(
                activity.user.id,
                activity.user.tenant_id,
                activity.distance / 1000.0,
            )

        # Update Event progress
        try:
            from events.services import EventProgressService
            membership = activity.user.club_memberships.filter(status='ACTIVE').first()
            EventProgressService.record_activity(
                user=activity.user,
                km=activity.distance / 1000.0,
                tenant_id=activity.user.tenant_id,
                club_id=membership.club_id if membership else None,
            )
        except Exception as exc:
            logger.warning("event_progress_update_failed activity_id=%d err=%s", activity_id, exc)

        # Fire plugin hooks
        try:
            from core.plugin_registry import registry
            registry.fire('activity.verified', activity=activity)
        except Exception as exc:
            logger.warning("plugin_hook_failed activity_id=%d err=%s", activity_id, exc)

    else:
        # Suspicious — alert Matrix room
        try:
            from core.matrix_provisioner import MatrixProvisioner
            MatrixProvisioner.send_notification(
                "!admin_room_id:matrix.org",
                f"🚨 Suspicious activity #{activity_id} by {activity.user.username}. "
                f"Anomaly ratio: {processing.anomaly_ratio:.0%}. "
                f"Is suspicious: {processing.is_suspicious}.",
            )
        except Exception as exc:
            logger.warning("matrix_alert_failed activity_id=%d err=%s", activity_id, exc)

    logger.info(
        "process_activity_async.done activity_id=%d verified=%s score=%.3f anomaly_ratio=%.2f",
        activity_id, is_verified, verification_score, processing.anomaly_ratio,
    )
    return {
        "status": "done",
        "activity_id": activity_id,
        "is_verified": is_verified,
        "verification_score": round(verification_score, 4),
        "anomaly_ratio": round(processing.anomaly_ratio, 4),
        "distance_m": round(processing.total_distance_m, 2),
    }


@shared_task(
    queue="notifications",
    name="activities.tasks.send_leaderboard_digest",
    ignore_result=True,
)
def send_leaderboard_digest(city_id: str, top_n: int = 10) -> None:
    """
    Sends a weekly leaderboard digest to the city's Matrix room.

    Args:
        city_id: Tenant ID (city/company).
        top_n: Number of top athletes to include.
    """
    from activities.leaderboards import LeaderboardService
    from core.matrix_provisioner import MatrixProvisioner

    top = LeaderboardService.get_top_users(city_id, limit=top_n)
    if not top:
        return

    lines = [f"🏆 Tygodniowy ranking — {city_id}:\n"]
    for idx, entry in enumerate(top, 1):
        lines.append(f"{idx}. User #{entry['user_id']} — {entry['score']:.1f} km")

    message = "\n".join(lines)
    MatrixProvisioner.send_notification(f"!city_{city_id}:matrix.org", message)
    logger.info("leaderboard_digest.sent city_id=%s top_n=%d", city_id, len(top))
