from django.contrib.gis.db import models
from django.conf import settings


class Club(models.Model):
    """
    A user-created sports club. Can participate in Club Challenges.

    Clubs are the grassroots competitive unit of the SPORT platform,
    sitting below cities and corporations in the hierarchy.
    """

    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='clubs/logos/', null=True, blank=True)

    # Sport focus
    SPORT_TYPES = [
        ('MIXED', 'Mixed'),
        ('RUN', 'Running'),
        ('BIKE', 'Cycling'),
        ('WALK', 'Walking'),
    ]
    sport_type = models.CharField(
        max_length=10, choices=SPORT_TYPES, default='MIXED'
    )

    # Tenant association (optional — clubs can be city-affiliated)
    tenant_id = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='City or company tenant this club belongs to'
    )

    # Matrix room for E2EE club chat (provisioned automatically on creation)
    matrix_room_id = models.CharField(max_length=200, blank=True)

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='owned_clubs',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['tenant_id', 'sport_type'])]

    def __str__(self) -> str:
        return f'{self.name} ({self.sport_type})'

    @property
    def member_count(self) -> int:
        return self.memberships.filter(status='ACTIVE').count()


class ClubMembership(models.Model):
    """
    Tracks a user's membership in a club and their contribution stats.
    """

    STATUS_CHOICES = [
        ('PENDING', 'Pending Approval'),
        ('ACTIVE', 'Active Member'),
        ('BANNED', 'Banned'),
    ]

    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='club_memberships',
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ACTIVE')
    role = models.CharField(
        max_length=10,
        choices=[('MEMBER', 'Member'), ('CAPTAIN', 'Captain')],
        default='MEMBER',
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    total_km = models.FloatField(default=0.0, help_text='Contributed km in active challenges')

    class Meta:
        unique_together = ('club', 'user')

    def __str__(self) -> str:
        return f'{self.user.username} → {self.club.name} ({self.status})'


class ClubChallenge(models.Model):
    """
    A direct head-to-head challenge between two clubs.

    Winner is determined by normalized score:
    Score = total_km * complexity_factor / active_members
    """

    challenger = models.ForeignKey(
        Club, on_delete=models.CASCADE, related_name='challenges_issued'
    )
    opponent = models.ForeignKey(
        Club, on_delete=models.CASCADE, related_name='challenges_received'
    )

    title = models.CharField(max_length=200)
    sport_type = models.CharField(max_length=10, default='MIXED')
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')

    challenger_score = models.FloatField(default=0.0)
    opponent_score = models.FloatField(default=0.0)

    winner = models.ForeignKey(
        Club,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='won_challenges',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['status', 'start_date'])]

    def __str__(self) -> str:
        return f'{self.challenger.name} vs {self.opponent.name} — {self.title}'

    def compute_normalized_score(self, club: Club) -> float:
        """
        Computes normalized challenge score for a club.

        Args:
            club: The club to compute the score for.

        Returns:
            Normalized float score: total_km / active_members.
        """
        members = club.memberships.filter(status='ACTIVE')
        active_count = members.count()
        if active_count == 0:
            return 0.0
        total_km = members.aggregate(
            total=models.Sum('total_km')
        )['total'] or 0.0
        return total_km / active_count
