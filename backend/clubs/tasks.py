"""
Matrix Async Tasks — SPORT Platform (Milestone 3)
===================================================
Wraps all Matrix API calls in Celery tasks to prevent blocking the
main Django request cycle. Matrix ops can be slow (TLS + E2EE setup).

Queues used:
    notifications — lower priority than 'critical' (telemetry).
"""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    queue="notifications",
    max_retries=3,
    default_retry_delay=60,
    name="clubs.tasks.provision_matrix_room",
)
def provision_matrix_room_async(self, club_id: int) -> dict:
    """
    Async Celery wrapper for MatrixProvisioner.create_club_room().

    Triggered by the post_save signal on Club creation.
    Offloads E2EE room creation to the notifications queue to avoid
    blocking the HTTP request that created the club.

    Args:
        club_id: Club primary key.

    Returns:
        dict with status and room_id.
    """
    from clubs.models import Club
    from core.matrix_provisioner import MatrixProvisioner

    try:
        club = Club.objects.get(pk=club_id)
    except Club.DoesNotExist:
        logger.error("provision_matrix_room: club_id=%d not found", club_id)
        return {"status": "error", "reason": "not_found"}

    if club.matrix_room_id:
        logger.debug("provision_matrix_room: room already exists club_id=%d", club_id)
        return {"status": "skipped", "reason": "room_exists"}

    try:
        room_id = MatrixProvisioner.create_club_room(
            club_name=club.name,
            club_id=club.pk,
        )
    except Exception as exc:
        logger.error("provision_matrix_room: unexpected error club_id=%d err=%s", club_id, exc)
        raise self.retry(exc=exc)

    if room_id:
        Club.objects.filter(pk=club_id).update(matrix_room_id=room_id)
        logger.info("provision_matrix_room: SUCCESS club_id=%d room=%s", club_id, room_id)
        return {"status": "ok", "room_id": room_id}

    logger.warning("provision_matrix_room: FAILED club_id=%d (no room_id returned)", club_id)
    raise self.retry(exc=RuntimeError("Matrix returned no room_id"))


@shared_task(
    bind=True,
    queue="notifications",
    max_retries=2,
    default_retry_delay=30,
    name="clubs.tasks.send_matrix_notification",
)
def send_matrix_notification_async(self, room_id: str, message: str) -> dict:
    """
    Async wrapper for MatrixProvisioner.send_notification().

    Used for: welcome messages, leaderboard milestones, anti-cheat alerts.

    Args:
        room_id: Target Matrix room ID.
        message: Plain-text message body.

    Returns:
        dict with status.
    """
    from core.matrix_provisioner import MatrixProvisioner

    try:
        success = MatrixProvisioner.send_notification(room_id, message)
    except Exception as exc:
        logger.error("send_matrix_notification: error room=%s err=%s", room_id, exc)
        raise self.retry(exc=exc)

    if success:
        logger.info("send_matrix_notification: sent room=%s", room_id)
        return {"status": "ok"}

    logger.warning("send_matrix_notification: failed room=%s", room_id)
    return {"status": "failed"}


@shared_task(
    bind=True,
    queue="notifications",
    max_retries=2,
    default_retry_delay=30,
    name="clubs.tasks.invite_member_to_matrix",
)
def invite_member_to_matrix_async(self, room_id: str, matrix_user_id: str, club_id: int) -> dict:
    """
    Async wrapper for MatrixProvisioner.invite_user().

    Triggered when a ClubMembership becomes ACTIVE.

    Args:
        room_id: Matrix room ID.
        matrix_user_id: User's Matrix ID (e.g. @user:matrix.org).
        club_id: For logging context.

    Returns:
        dict with status.
    """
    from core.matrix_provisioner import MatrixProvisioner

    try:
        success = MatrixProvisioner.invite_user(room_id, matrix_user_id)
    except Exception as exc:
        logger.error(
            "invite_member: error room=%s user=%s err=%s",
            room_id,
            matrix_user_id,
            exc,
        )
        raise self.retry(exc=exc)

    if success:
        logger.info("invite_member: sent room=%s user=%s", room_id, matrix_user_id)
        return {"status": "ok"}

    logger.warning("invite_member: failed room=%s user=%s", room_id, matrix_user_id)
    return {"status": "failed"}
