"""
Django Signals — Clubs app
===========================
Auto-provisions Matrix room on Club creation (Constitution §21.2).
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Club, ClubMembership

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Club)
def provision_matrix_room_on_creation(sender, instance: Club, created: bool, **kwargs) -> None:
    """
    Automatically creates a Matrix E2EE room for a new Club.

    Runs only on creation and only if no room has been provisioned yet.
    Saves the room_id back to the Club instance without triggering another signal.

    Args:
        instance: The saved Club model instance.
        created: True if this is a new object.
    """
    if not created or instance.matrix_room_id:
        return

    from core.matrix_provisioner import MatrixProvisioner
    room_id = MatrixProvisioner.create_club_room(
        club_name=instance.name,
        club_id=instance.pk,
    )
    if room_id:
        # Use queryset update to avoid re-triggering post_save
        Club.objects.filter(pk=instance.pk).update(matrix_room_id=room_id)
        instance.matrix_room_id = room_id
        logger.info("club.matrix_provisioned club_id=%d room=%s", instance.pk, room_id)
    else:
        logger.warning("club.matrix_provision_failed club_id=%d", instance.pk)


@receiver(post_save, sender=ClubMembership)
def notify_matrix_on_new_member(sender, instance: ClubMembership, created: bool, **kwargs) -> None:
    """
    Sends a welcome notification to the club's Matrix room when a new member joins.

    Args:
        instance: The saved ClubMembership instance.
        created: True if this is a new membership.
    """
    if not created or instance.status != 'ACTIVE':
        return

    club = instance.club
    if not club.matrix_room_id:
        return

    from core.matrix_provisioner import MatrixProvisioner
    message = (
        f"👋 {instance.user.username} dołączył/a do klubu {club.name}! "
        f"Łączna liczba aktywnych członków: {club.member_count}."
    )
    MatrixProvisioner.send_notification(club.matrix_room_id, message)
    logger.info(
        "club.matrix_welcome_sent user=%s club=%s",
        instance.user_id, club.pk,
    )
