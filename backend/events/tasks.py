"""
Events Periodic Tasks — SPORT Platform
=========================================
Celery Beat tasks for automated event lifecycle management.
"""

from __future__ import annotations

import json
import logging

from celery import shared_task
from django.utils import timezone

from core.redis_cluster import get_redis

logger = logging.getLogger(__name__)


@shared_task(queue="default", name="events.tasks.close_expired_events", ignore_result=True)
def close_expired_events() -> None:
    """
    Marks ACTIVE events as COMPLETED if their end_date has passed.
    Runs daily at 00:05 via Celery Beat.

    Also resets the Redis leaderboard for completed events to free memory.
    """
    from events.models import Event
    from activities.leaderboards import LeaderboardService

    now = timezone.now()
    expired = Event.objects.filter(status="ACTIVE", end_date__lt=now)
    count = expired.count()

    if count == 0:
        logger.info("close_expired_events: no expired events found")
        return

    for event in expired:
        event.status = "COMPLETED"
        event.save(update_fields=["status"])
        LeaderboardService.reset(event.id, scope="event")
        logger.info("event.completed event_id=%d title=%s", event.id, event.title)

    logger.info("close_expired_events: closed %d events", count)


@shared_task(queue="default", name="events.tasks.publish_scheduled_events", ignore_result=True)
def publish_scheduled_events() -> None:
    """
    Transitions PUBLISHED events to ACTIVE when their start_date arrives.
    Runs every 5 minutes (add to beat_schedule if needed).
    """
    from events.models import Event
    from core.matrix_provisioner import MatrixProvisioner

    now = timezone.now()
    to_activate = Event.objects.filter(status="PUBLISHED", start_date__lte=now)

    for event in to_activate:
        event.status = "ACTIVE"
        event.save(update_fields=["status"])
        logger.info("event.activated event_id=%d", event.id)

        if event.club and event.club.matrix_room_id:
            MatrixProvisioner.send_notification(
                event.club.matrix_room_id,
                f'🏁 Event "{event.title}" właśnie się rozpoczął! Czas na ruch!',
            )

        warm_event_start.delay(event.id)


@shared_task(queue="critical", name="events.tasks.warm_event_start", ignore_result=True)
def warm_event_start(event_id: int) -> None:
    """
    Pre-cache event metadata in Redis and reset burst counters before go-live.
    """
    from events.models import Event
    from events.burst import cache_event_meta, reset_burst_counters, set_burst_warm_active

    try:
        event = Event.objects.get(pk=event_id)
    except Event.DoesNotExist:
        logger.warning("warm_event_start: event_id=%s not found", event_id)
        return

    reset_burst_counters(event_id)
    set_burst_warm_active(event_id, event)
    cache_event_meta(event)
    logger.info("event.warm_start event_id=%s title=%s", event.id, event.title)


@shared_task(queue="critical", name="events.tasks.start_event_session_async")
def start_event_session_async(
    user_id: int, event_id: int, payload: dict | None = None
) -> int | None:
    """Create an activity session on behalf of a queued user (burst deferral path)."""
    from django.contrib.auth import get_user_model

    from activities.models import Activity
    from events.burst import (
        clear_active_session,
        get_active_session_activity_id,
        resolve_event_for_session,
        session_start_rate_limit,
        set_active_session,
    )

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return None

    event = resolve_event_for_session(user, event_id)
    if not event:
        return None

    allowed, _, _ = session_start_rate_limit(event_id)
    if not allowed:
        from events.burst import queue_session_start

        queue_session_start(event_id, user_id, payload or {})
        return None

    existing_id = get_active_session_activity_id(event_id, user_id)
    if existing_id:
        if Activity.objects.filter(pk=existing_id, user=user, end_time__isnull=True).exists():
            return existing_id
        clear_active_session(event_id, user_id)

    data = payload or {}
    activity = Activity.objects.create(
        user=user,
        tenant=getattr(user, "tenant", None),
        type=data.get("type", "RUN"),
        start_time=data.get("start_time") or timezone.now(),
    )
    set_active_session(event_id, user_id, activity.id)
    logger.info(
        "event.session_started_async user_id=%s event_id=%s activity_id=%s",
        user_id,
        event_id,
        activity.id,
    )
    return activity.id


@shared_task(queue="critical", name="events.tasks.process_event_start_queue", ignore_result=True)
def process_event_start_queue(event_id: int, max_items: int = 50) -> int:
    """Drain deferred session-start queue for an event. Returns sessions dispatched."""
    from events.burst import burst_keys, session_start_rate_limit
    from events.models import Event

    try:
        Event.objects.get(pk=event_id)
    except Event.DoesNotExist:
        return 0

    keys = burst_keys(event_id)
    started = 0
    try:
        r = get_redis()
    except Exception as exc:
        logger.warning("process_event_start_queue redis failed: %s", exc)
        return 0

    for _ in range(max_items):
        allowed, _, _ = session_start_rate_limit(event_id)
        if not allowed:
            break
        raw = r.rpop(keys["session_queue"])
        if not raw:
            break
        if isinstance(raw, bytes):
            raw = raw.decode()
        try:
            entry = json.loads(raw)
            start_event_session_async.delay(
                entry["user_id"],
                event_id,
                entry.get("payload") or {},
            )
            started += 1
        except Exception as exc:
            logger.warning("process_event_start_queue pop failed: %s", exc)

    if started:
        logger.info("event.session_queue_drained event_id=%s dispatched=%s", event_id, started)
    return started
