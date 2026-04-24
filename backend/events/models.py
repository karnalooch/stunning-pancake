from django.contrib.gis.db import models
from django.conf import settings


class Event(models.Model):
    """
    A time-bound sports competition hosted by a tenant, city, or club.

    Supports three core event types:
    - ACCUMULATIVE: Total km/elevation/time within the event period.
    - CHECKPOINT: Users must visit ordered POI geofences.
    - INTER_TENANT: Head-to-head between cities/companies with normalization.
    """

    EVENT_TYPES = [
        ('ACCUMULATIVE', 'Accumulative Distance/Elevation'),
        ('CHECKPOINT', 'Checkpoint / POI Run'),
        ('ROUTE_MATCH', 'Route Match Race'),
        ('INTER_TENANT', 'City vs City / Company vs Company'),
        ('CLUB_BATTLE', 'Club vs Club Challenge'),
    ]

    SPORT_FILTERS = [
        ('ALL', 'All Sports'),
        ('RUN', 'Running Only'),
        ('BIKE', 'Cycling Only'),
        ('RUN_BIKE', 'Running & Cycling'),
    ]

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('PUBLISHED', 'Published'),
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    # Identity
    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=300, unique=True)
    description = models.TextField(blank=True)
    banner = models.ImageField(upload_to='events/banners/', null=True, blank=True)

    # Type and rules
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, default='ACCUMULATIVE')
    sport_filter = models.CharField(max_length=10, choices=SPORT_FILTERS, default='ALL')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='DRAFT')

    # Timing
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()

    # Tenant scope
    tenant_id = models.CharField(max_length=100, null=True, blank=True,
                                  help_text='Owner city or company')
    opponent_tenant_id = models.CharField(max_length=100, null=True, blank=True,
                                           help_text='For INTER_TENANT events')

    # Club scope (for CLUB_BATTLE)
    club = models.ForeignKey(
        'clubs.Club', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='events'
    )
    opponent_club = models.ForeignKey(
        'clubs.Club', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='opponent_events'
    )

    # Geofence boundary (required for CHECKPOINT and INTER_TENANT)
    boundary = models.PolygonField(
        null=True, blank=True, srid=4326,
        help_text='GeoJSON polygon defining the event area'
    )

    # Anti-Cheat
    require_brouter_validation = models.BooleanField(default=True)

    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_events'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', 'start_date']),
            models.Index(fields=['tenant_id', 'status']),
        ]

    def __str__(self) -> str:
        return f'[{self.event_type}] {self.title} ({self.status})'


class Participation(models.Model):
    """
    Tracks a user's contribution to an event.

    Updated in real-time by the Signal Pipeline when an Activity is verified.
    """

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='participations')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='event_participations'
    )

    total_km = models.FloatField(default=0.0)
    total_elevation_m = models.FloatField(default=0.0)
    activity_count = models.IntegerField(default=0)

    # Normalized score: total_km * complexity_factor / 1 (individual)
    score = models.FloatField(default=0.0)

    joined_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('event', 'user')
        indexes = [models.Index(fields=['event', 'score'])]

    def __str__(self) -> str:
        return f'{self.user.username} → {self.event.title}: {self.total_km:.1f} km'

    def update_score(self, km_delta: float, elevation_delta: float = 0) -> None:
        """
        Increments participation stats and recalculates score.

        Args:
            km_delta: Verified kilometres to add.
            elevation_delta: Elevation gain in metres (optional).
        """
        self.total_km += km_delta
        self.total_elevation_m += elevation_delta
        self.activity_count += 1
        # Simple normalization: 1 km = 1 point; elevation bonus 0.1pt/100m
        self.score = self.total_km + (self.total_elevation_m / 100 * 0.1)
        self.save()


class Achievement(models.Model):
    """
    A milestone badge awarded to a user within an event.

    Example: "First 10km", "Top 3 in city", "100% Club Soldier"
    """

    ACHIEVEMENT_TYPES = [
        ('MILESTONE_KM', 'Distance Milestone'),
        ('MILESTONE_RANK', 'Leaderboard Rank'),
        ('COMPLETION', 'Event Completion'),
        ('STREAK', 'Activity Streak'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='achievements'
    )
    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name='achievements', null=True, blank=True
    )
    achievement_type = models.CharField(max_length=20, choices=ACHIEVEMENT_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=100, default='trophy')  # icon name/key
    awarded_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)  # {km: 10, rank: 3, etc.}

    class Meta:
        indexes = [models.Index(fields=['user', 'achievement_type'])]

    def __str__(self) -> str:
        return f'{self.user.username} — {self.title}'
