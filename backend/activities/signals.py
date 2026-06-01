import logging
import json
import os
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Activity, PrivacyZone
import redis

logger = logging.getLogger(__name__)

# Initialize Redis client for inter-service communication
redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://redis:6379/0'))

_PROCESS_QUEUE_TTL_S = 300


@receiver(post_save, sender=Activity)
def validate_activity_on_completion(sender, instance, created, **kwargs):
    """
    Trigger anti-cheat validation when an activity is finished with a route.
    Dedupes Celery enqueue via Redis SET NX (avoids double process on rapid saves).
    """
    if not instance.end_time or not instance.route_path or instance.is_verified:
        return
    if created:
        return

    try:
        from core.redis_cluster import get_redis
        queue_key = f"process:activity:{instance.id}"
        if not get_redis().set(queue_key, "1", nx=True, ex=_PROCESS_QUEUE_TTL_S):
            return
    except Exception as exc:
        logger.warning(
            "process_activity queue dedupe failed activity_id=%s err=%s",
            instance.id,
            exc,
        )

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

