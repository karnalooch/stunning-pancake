import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Activity

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Activity)
def validate_activity_on_completion(sender, instance, created, **kwargs):
    """
    Trigger anti-cheat validation and privacy masking when an activity is marked as finished.
    """
    if not created and instance.end_time and instance.route_path and not instance.is_verified:
        from .tasks import process_activity_async
        process_activity_async.delay(instance.id)

