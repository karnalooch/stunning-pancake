import json
import logging
import os

import redis
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Activity, PrivacyZone

logger = logging.getLogger(__name__)

# Initialize Redis client for inter-service communication
redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://redis:6379/0'))

@receiver(post_save, sender=Activity)
def validate_activity_on_completion(sender, instance, created, **kwargs):
    """
    Trigger anti-cheat validation and privacy masking when an activity is marked as finished.
    """
    if not created and instance.end_time and instance.route_path and not instance.is_verified:
        from .tasks import process_activity_async
        process_activity_async.delay(instance.id)


@receiver(post_save, sender=PrivacyZone)
def notify_privacy_zone_update(sender, instance, created, **kwargs):
    """
    Publishes privacy zone updates to Redis for the Telemetry service to consume.
    This ensures real-time geofencing (Live-Ghost Phase 4).
    """
    try:
        data = {
            "type": "ZONE_UPDATE",
            "user_id": instance.user.id,
            "zone_id": instance.id,
            "lat": instance.center.y,
            "lon": instance.center.x,
            "radius": instance.radius,
        }
        redis_client.publish('privacy_zones:updates', json.dumps(data))
    except Exception as e:
        logger.error(f"Failed to publish privacy zone update: {e}")


@receiver(post_delete, sender=PrivacyZone)
def notify_privacy_zone_delete(sender, instance, **kwargs):
    """
    Publishes privacy zone deletion to Redis.
    """
    try:
        data = {
            "type": "ZONE_DELETE",
            "user_id": instance.user.id,
            "zone_id": instance.id,
        }
        redis_client.publish('privacy_zones:updates', json.dumps(data))
    except Exception as e:
        logger.error(f"Failed to publish privacy zone deletion: {e}")

