import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Activity
from .services import BRouterService, PrivacyService, MatrixService
from .leaderboards import LeaderboardService
from .signal_processing import GpsPoint, process_gps_track

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Activity)
def validate_activity_on_completion(sender, instance, created, **kwargs):
    """
    Trigger anti-cheat validation and privacy masking when an activity is marked as finished.
    """
    if not created and instance.end_time and instance.route_path and not instance.is_verified:
        # Apply Privacy Masking first
        masked_path = PrivacyService.mask_track(instance.user, instance.route_path)
        if not masked_path:
            return # Activity invalid after masking
            
        instance.route_path = masked_path

        coords = list(instance.route_path.coords)

        # --- Constitution §24.2: Signal Processing Pipeline ---
        raw_points = [
            GpsPoint(lat=c[1], lon=c[0], timestamp=float(i))
            for i, c in enumerate(coords)
        ]
        result = BRouterService.validate_track(instance.type, coords)
        processing = process_gps_track(
            raw_points=raw_points,
            activity_type=instance.type,
            brouter_result=result,
        )

        if processing.is_suspicious:
            logger.warning(
                'signal_anomaly user=%s ratio=%.2f anomalies=%s',
                instance.user_id,
                processing.anomaly_ratio,
                processing.anomalous_indices[:5],
            )
        
        if result['success']:
            b_dist = float(result['brouter_distance'])
            gps_dist = instance.distance
            
            if gps_dist > 0:
                ratio = abs(b_dist - gps_dist) / gps_dist
                instance.verification_score = 1.0 - ratio
                if ratio < 0.15: # 15% tolerance
                    instance.is_verified = True
                    
                    # Update City Leaderboard if verified
                    if instance.user.tenant_id:
                        LeaderboardService.update_score(
                            instance.user.id, 
                            instance.user.tenant_id, 
                            instance.distance / 1000.0 # Convert to KM for score
                        )

                    # Update Event Progress (Phase 6)
                    try:
                        from events.services import EventProgressService
                        club_membership = instance.user.club_memberships.filter(
                            status='ACTIVE'
                        ).first()
                        EventProgressService.record_activity(
                            user=instance.user,
                            km=instance.distance / 1000.0,
                            tenant_id=instance.user.tenant_id,
                            club_id=club_membership.club_id if club_membership else None,
                        )
                    except Exception as e:
                        logger.warning('event_progress_update_failed: %s', e)

                    # --- Constitution §23: Fire Plugin Hooks ---
                    try:
                        from core.plugin_registry import registry
                        registry.fire('activity.verified', activity=instance)
                    except Exception as e:
                        logger.warning('plugin_hook_fire_failed: %s', e)

                else:
                    # Notify Moderators via Matrix if fraud suspected
                    MatrixService.send_alert(
                        "!admin_room_id:matrix.org",
                        f"Suspicious activity by {instance.user.username}. Deviation: {round(ratio*100, 2)}%"
                    )
            
            Activity.objects.filter(pk=instance.pk).update(
                is_verified=instance.is_verified,
                verification_score=instance.verification_score,
                route_path=instance.route_path # Save masked path
            )

