from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Activity
from .services import BRouterService, PrivacyService
from .leaderboards import LeaderboardService

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
        
        coords = instance.route_path.coords
        result = BRouterService.validate_track(instance.type, coords)
        
        if result['success']:
            b_dist = float(result['brouter_distance'])
            gps_dist = instance.distance
            
            if gps_dist > 0:
                ratio = abs(b_dist - gps_dist) / gps_dist
                instance.verification_score = 1.0 - ratio
                if ratio < 0.15: # 15% tolerance
                    instance.is_verified = True
                    
                    # Update Leaderboard if verified
                    if instance.user.tenant_id:
                        LeaderboardService.update_score(
                            instance.user.id, 
                            instance.user.tenant_id, 
                            instance.distance / 1000.0 # Convert to KM for score
                        )
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
