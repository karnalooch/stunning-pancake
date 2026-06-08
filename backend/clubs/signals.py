"""
Django Signals — Clubs app
===========================
Auto-provisions Matrix room on Club creation (Constitution §21.2).
Milestone 3: All Matrix calls are now async (Celery notifications queue).
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Club, ClubMembership

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Club)
def provision_matrix_room_on_creation(sender, instance: Club, created: bool, **kwargs) -> None:
    """
    Dispatches async Celery task to provision a Matrix E2EE room for a new Club.

    Runs only on creation and only if no room has been provisioned yet.
    Matrix API call is deferred to the 'notifications' queue to avoid
    blocking the HTTP request that created the club.

    Args:
        instance: The saved Club model instance.
        created: True if this is a new object.
    """
    if not created or instance.matrix_room_id:
        return

    # Defer to Celery — do NOT block the HTTP request
    from clubs.tasks import provision_matrix_room_async

    provision_matrix_room_async.delay(instance.pk)
    logger.info("club.matrix_provision_queued club_id=%d", instance.pk)


@receiver(post_save, sender=ClubMembership)
def notify_matrix_on_new_member(sender, instance: ClubMembership, created: bool, **kwargs) -> None:
    """
    Sends a welcome notification and invite to the club's Matrix room when a new member joins.

    If the user has a Matrix ID configured in their profile,
    they are also invited to the room. All operations are async.

    Args:
        instance: The saved ClubMembership instance.
        created: True if this is a new membership.
    """
    if not created or instance.status != "ACTIVE":
        return

    club = instance.club
    if not club.matrix_room_id:
        return

    from clubs.tasks import invite_member_to_matrix_async, send_matrix_notification_async

    # Welcome notification in club room
    message = (
        f"👋 {instance.user.username} dołączył/a do klubu {club.name}! "
        f"Łączna liczba aktywnych członków: {club.member_count}."
    )
    send_matrix_notification_async.delay(club.matrix_room_id, message)

    # Invite user if they have a Matrix ID
    matrix_user_id = getattr(instance.user, "matrix_user_id", None)
    if matrix_user_id:
        invite_member_to_matrix_async.delay(
            room_id=club.matrix_room_id,
            matrix_user_id=matrix_user_id,
            club_id=club.pk,
        )
        logger.info(
            "club.matrix_invite_queued user=%s club=%d",
            instance.user_id,
            club.pk,
        )
