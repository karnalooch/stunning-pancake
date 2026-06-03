"""
Celery Async Tasks — Activities App
=====================================
Constitution §9.2: Asynchronous Processing & Task Queues
Milestone 2: Engine V2 & Anti-Cheat

Optimized Pipeline:
1. Privacy masking.
2. Lightweight Heuristics (V-max) - REJECTS WITHOUT BROUTER if suspicious.
3. BRouter (only if clean) - Map matching & topology validation.
4. Redis & PG Leaderboard updates.
"""

from __future__ import annotations

import logging
from celery import shared_task
from kombu import Queue, Exchange

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
    Optimized async pipeline for a completed activity.
    Implements Milestone 2 'Lightweight Heuristics' (Constitution §24.3).
    """
    import json
    from core.redis_cluster import get_redis
    from activities.models import Activity
    from activities.services import BRouterService, PrivacyService
    from activities.signal_processing import (
        GpsPoint,
        process_gps_track,
        analyze_anomalies,
        GpsKalmanSmoother,
        fast_rejection_gate,
    )
    from django.contrib.gis.geos import LineString

    # Fetch dynamic config
    r = get_redis()
    config_raw = r.get("telemetry:config")
    config = json.loads(config_raw) if config_raw else {}
    brouter_multiplier = config.get("brouterCutoff", 1.5)
    ml_sensitivity = config.get("mlSensitivity", 0.8)
    auto_ban = config.get("autoBan", True)

    try:
        activity = Activity.objects.select_related("user").get(pk=activity_id)
    except Activity.DoesNotExist:
        logger.error("process_activity_async: activity_id=%d not found", activity_id)
        return {"status": "error", "reason": "not_found"}

    if activity.is_verified or not activity.route_path or not activity.end_time:
        return {"status": "skipped", "reason": "already_processed_or_incomplete"}

    # --- Step 1: Privacy masking ---
    masked_path = PrivacyService.mask_track(activity.user, activity.route_path)
    if not masked_path:
        return {"status": "skipped", "reason": "masked_empty"}

    coords = list(masked_path.coords)
    base_ts = activity.start_time.timestamp()
    # Try to extract real timestamps from route_path if available
    # Fallback: assume 1-second intervals (common GPS sampling rate)
    raw_points = [GpsPoint(lat=c[1], lon=c[0], timestamp=base_ts + i) for i, c in enumerate(coords)]

    # --- Step 2: FAST SELECTION GATE (Layer 1 Anti-Cheat) ---
    # O(N) pure math — no DB, no network. Catches trams, cars, GPS spoofs.
    gate = fast_rejection_gate(raw_points, activity.type)
    if not gate["passed"] and auto_ban:
        logger.warning(
            "activity.rejected_gate activity_id=%d reason=%s details=%s",
            activity_id,
            gate["reason"],
            gate["details"],
        )
        Activity.objects.filter(pk=activity_id).update(is_verified=False, verification_score=0.0)
        try:
            from core.plugin_registry import registry

            registry.fire("activity.suspicious", activity=activity, anomaly_ratio=1.0)
        except Exception:
            pass
        return {
            "status": "rejected_gate",
            "reason": gate["reason"],
            "details": gate["details"],
        }

    # --- Step 2.5: ML ANOMALY DETECTOR (Layer 1.5 — Milestone 5) ---
    try:
        from activities.ml_anomaly import is_ml_anomaly

        if is_ml_anomaly(raw_points, sensitivity=ml_sensitivity) and auto_ban:
            logger.warning("activity.rejected_ml activity_id=%d", activity_id)
            Activity.objects.filter(pk=activity_id).update(
                is_verified=False, verification_score=0.0
            )
            try:
                from core.plugin_registry import registry

                registry.fire("activity.suspicious", activity=activity, anomaly_ratio=0.9)
            except Exception:
                pass
            return {"status": "rejected_ml", "reason": "isolation_forest_anomaly"}
    except Exception as exc:
        logger.warning("ml_anomaly.skip activity_id=%d err=%s", activity_id, exc)

    # --- Step 3: Lightweight V-max Heuristics (Layer 2 Anti-Cheat) ---
    smoother = GpsKalmanSmoother()
    smoothed = smoother.smooth(raw_points)
    analysis = analyze_anomalies(smoothed, activity.type)

    if analysis["is_suspicious"] and auto_ban:
        logger.warning(
            "activity.rejected_early activity_id=%d reason=%s", activity_id, analysis["reason"]
        )
        Activity.objects.filter(pk=activity_id).update(is_verified=False, verification_score=0.0)

        try:
            from core.plugin_registry import registry

            registry.fire(
                "activity.suspicious", activity=activity, anomaly_ratio=analysis["anomaly_ratio"]
            )
            from core.matrix_provisioner import MatrixProvisioner

            MatrixProvisioner.send_notification(
                "!admin_room_id:matrix.org",
                f"🚨 [LIGHTWEIGHT] Rejected #{activity_id} ({activity.type}) by {activity.user.username}. "
                f"Reason: {analysis['reason']}",
            )
        except Exception:
            pass

        return {
            "status": "rejected_early",
            "reason": analysis["reason"],
            "anomaly_ratio": analysis["anomaly_ratio"],
        }

    # --- Step 3: BRouter validation (Only if clean) ---
    brouter_result = BRouterService.validate_track(activity.type, coords)

    # Full processing (Viterbi Map Matching)
    processing = process_gps_track(
        raw_points=raw_points,
        activity_type=activity.type,
        brouter_result=brouter_result,
    )

    if len(processing.matched_points) >= 2:
        matched_coords = [(p.lon, p.lat) for p in processing.matched_points]
        activity.route_path = LineString(matched_coords, srid=4326)

    # --- Step 4: Final verification scoring ---
    is_verified = False
    verification_score = 0.0

    if brouter_result.get("success"):
        b_dist = float(brouter_result["brouter_distance"])
        gps_dist = processing.total_distance_m
        if gps_dist > 0:
            ratio = abs(b_dist - gps_dist) / gps_dist
            verification_score = 1.0 - ratio

            # Use dynamic tolerance: base 0.10 * multiplier (e.g. 1.5x = 0.15)
            tolerance = 0.10 * brouter_multiplier
            is_verified = ratio < tolerance

    # --- Step 5: Plugin-based validation (Sport specific) ---
    if is_verified:
        try:
            from core.plugin_registry import registry

            plugin_results = registry.fire(
                "validate_activity", activity=activity, processing_result=processing
            )
            if False in plugin_results:
                logger.warning("activity.rejected_by_plugin activity_id=%d", activity_id)
                is_verified = False
        except Exception as exc:
            logger.error("plugin_validation_error activity_id=%d err=%s", activity_id, exc)

    # --- Step 6: Persist results ---
    Activity.objects.filter(pk=activity_id).update(
        is_verified=is_verified,
        verification_score=verification_score,
        route_path=activity.route_path,
    )

    if is_verified:
        activity.refresh_from_db()
        from activities.leaderboard_credit import credit_verified_activity

        credit_verified_activity(activity)

    return {"status": "done", "verified": is_verified}


@shared_task(queue="default", name="activities.tasks.refresh_city_rankings_mv")
def refresh_city_rankings_mv() -> None:
    """
    Refreshes the PostGIS Materialized View for city rankings.
    Milestone 2 Requirement: Async Materialized View updates.
    """
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY city_rankings_mv;")
    logger.info("city_rankings_mv refreshed")


@shared_task(queue="notifications", name="activities.tasks.send_leaderboard_digest")
def send_leaderboard_digest(city_id: str, top_n: int = 10) -> None:
    from activities.leaderboards import LeaderboardService
    from core.matrix_provisioner import MatrixProvisioner

    top = LeaderboardService.get_top_users(city_id, limit=top_n)
    if top:
        msg = f"🏆 Ranking {city_id}:\n" + "\n".join(
            [f"{i + 1}. {e['user_id']}: {e['score']:.1f}km" for i, e in enumerate(top)]
        )
        MatrixProvisioner.send_notification(f"!city_{city_id}:matrix.org", msg)


@shared_task(queue="default", name="activities.tasks.recalculate_city_leaderboard")
def recalculate_city_leaderboard(city_id: str = "") -> None:
    from django.db.models import Sum
    from activities.models import Activity
    from activities.leaderboards import LeaderboardService

    if city_id:
        cities = [city_id]
    else:
        cities = list(
            Activity.objects.filter(is_verified=True)
            .values_list("user__tenant_id", flat=True)
            .distinct()
        )

    for cid in cities:
        if not cid:
            continue
        qs = (
            Activity.objects.filter(is_verified=True, user__tenant_id=cid)
            .values("user_id")
            .annotate(total_km=Sum("distance"))
        )
        scores = {row["user_id"]: round((row["total_km"] or 0) / 1000.0, 3) for row in qs}
        if scores:
            LeaderboardService.batch_recalculate(cid, scores)
            refresh_city_rankings_mv.delay()


@shared_task(queue="default", name="activities.tasks.monitor_postgres_disk")
def monitor_postgres_disk() -> dict:
    """Periodic disk check — Redis safeguards + DiskAuditEvent (Celery beat)."""
    from activities.scale_disk_monitor import cleanup_simulated_activities, run_disk_monitor

    result = run_disk_monitor(source="cron")
    cleanup_simulated_activities(source="cron")
    return result


# Register Celery tasks in sibling modules (autodiscover only loads tasks.py).
from . import simulator_tasks  # noqa: F401
from . import wipe_tasks  # noqa: F401
