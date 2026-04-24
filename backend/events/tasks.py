"""
Events Periodic Tasks — SPORT Platform
=========================================
Celery Beat tasks for automated event lifecycle management.
"""
from __future__ import annotations

import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(queue='default', name='events.tasks.close_expired_events', ignore_result=True)
def close_expired_events() -> None:
    """
    Marks ACTIVE events as COMPLETED if their end_date has passed.
    Runs daily at 00:05 via Celery Beat.

    Also resets the Redis leaderboard for completed events to free memory.
    """
    from events.models import Event
    from activities.leaderboards import LeaderboardService

    now = timezone.now()
    expired = Event.objects.filter(status='ACTIVE', end_date__lt=now)
    count = expired.count()

    if count == 0:
        logger.info('close_expired_events: no expired events found')
        return

    for event in expired:
        event.status = 'COMPLETED'
        event.save(update_fields=['status'])
        # Free Redis memory for completed event leaderboard
        LeaderboardService.reset(event.id, scope='event')
        logger.info('event.completed event_id=%d title=%s', event.id, event.title)

    logger.info('close_expired_events: closed %d events', count)


@shared_task(queue='default', name='events.tasks.publish_scheduled_events', ignore_result=True)
def publish_scheduled_events() -> None:
    """
    Transitions PUBLISHED events to ACTIVE when their start_date arrives.
    Runs every 5 minutes (add to beat_schedule if needed).
    """
    from events.models import Event
    from core.matrix_provisioner import MatrixProvisioner

    now = timezone.now()
    to_activate = Event.objects.filter(status='PUBLISHED', start_date__lte=now)

    for event in to_activate:
        event.status = 'ACTIVE'
        event.save(update_fields=['status'])
        logger.info('event.activated event_id=%d', event.id)

        # Notify via Matrix if room is linked to a club
        if event.club and event.club.matrix_room_id:
            MatrixProvisioner.send_notification(
                event.club.matrix_room_id,
                f"🏁 Event \"{event.title}\" właśnie się rozpoczął! Czas na ruch!"
            )
