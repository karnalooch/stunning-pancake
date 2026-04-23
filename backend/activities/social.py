from django.utils import timezone

class SocialSharingService:
    """
    Service for generating data for dynamic Social Cards.
    Used for sharing activities on Instagram, Strava, etc.
    """
    @classmethod
    def generate_activity_card_data(cls, activity):
        """
        Returns structured data for the frontend to render a beautiful activity card.
        """
        return {
            "user": activity.user.username,
            "type": activity.get_type_display(),
            "distance_km": round(activity.distance / 1000.0, 2),
            "duration": str(activity.duration) if activity.duration else "N/A",
            "avg_speed": round((activity.distance / 1000.0) / (activity.duration.total_seconds() / 3600.0), 2) if activity.duration and activity.duration.total_seconds() > 0 else 0,
            "date": activity.start_time.strftime("%d %b %Y"),
            "is_verified": activity.is_verified,
            "tenant_name": activity.user.tenant_id if activity.user.tenant_id else "Independent Athlete"
        }

