from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Activity
from .services import BRouterService

@receiver(post_save, sender=Activity)
def validate_activity_on_completion(sender, instance, created, **kwargs):
    """
    Trigger anti-cheat validation when an activity is marked as finished (has end_time and route_path).
    """
    if not created and instance.end_time and instance.route_path and not instance.is_verified:
        # Extract coordinates from LineString
        coords = instance.route_path.coords
        
        # Call BRouter for validation
        result = BRouterService.validate_track(instance.type, coords)
        
        if result['success']:
            # Example logic: compare GPS distance with BRouter topological distance
            # If discrepancy is < 15%, mark as verified
            b_dist = float(result['brouter_distance'])
            gps_dist = instance.distance
            
            if gps_dist > 0:
                ratio = abs(b_dist - gps_dist) / gps_dist
                instance.verification_score = 1.0 - ratio
                if ratio < 0.15: # 15% tolerance
                    instance.is_verified = True
            
            # Save without triggering signal recursively
            Activity.objects.filter(pk=instance.pk).update(
                is_verified=instance.is_verified,
                verification_score=instance.verification_score
            )
