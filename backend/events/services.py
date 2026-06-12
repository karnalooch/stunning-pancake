import logging

from django.db import transaction

from activities.leaderboards import LeaderboardService
from core.sport_scope import activity_matches_sport_filter

from .models import Achievement, Event, Participation

logger = logging.getLogger(__name__)


class EventProgressService:
    """
    Core service for updating event progress when a verified activity arrives.

    Called by the Django Signal Pipeline (activities.signals) after BRouter
    validation succeeds. Thread-safe via select_for_update.
    """

    @classmethod
    @transaction.atomic
    def record_activity(
        cls,
        user,
        km: float,
        elevation_m: float = 0.0,
        tenant_id: str | None = None,
        club_id: int | None = None,
        activity_id: int | None = None,
        activity_type: str | None = None,
    ) -> None:
        """
        Updates all active events the user qualifies for.

        Args:
            user: The Django User instance.
            km: Verified kilometres from the activity.
            elevation_m: Elevation gain in metres.
            tenant_id: User's city/company for INTER_TENANT events.
            club_id: User's club for CLUB_BATTLE events.
            activity_id: Source activity (for logging; credit is idempotent upstream).
        """
        from django.utils import timezone

        now = timezone.now()

        active_events = Event.objects.filter(
            status="ACTIVE",
            start_date__lte=now,
            end_date__gte=now,
        ).select_for_update(skip_locked=True)

        for event in active_events:
            if not cls._user_qualifies(event, tenant_id, club_id):
                continue
            if activity_type and not activity_matches_sport_filter(
                activity_type, event.sport_filter
            ):
                continue

            participation, _ = Participation.objects.get_or_create(
                event=event,
                user=user,
            )
            participation.update_score(km, elevation_m)

            # Update Redis leaderboard
            cls._update_redis_leaderboard(event, user, participation.score)

            # Check milestone achievements
            cls._check_achievements(user, event, participation)

        logger.info(
            "event_progress.recorded user=%s km=%.2f events=%d activity_id=%s",
            user.username,
            km,
            active_events.count(),
            activity_id,
        )

    @staticmethod
    def _user_qualifies(event: Event, tenant_id: str | None, club_id: int | None) -> bool:
        """Returns True if user's tenant/club matches the event scope."""
        if event.event_type == "INTER_TENANT":
            return tenant_id in (event.tenant_id, event.opponent_tenant_id)
        if event.event_type == "CLUB_BATTLE":
            return club_id in (event.club_id, event.opponent_club_id)
        if event.tenant_id:
            return tenant_id == event.tenant_id
        return True  # Open / global event

    @staticmethod
    def _update_redis_leaderboard(event: Event, user, score: float) -> None:
        """Pushes score to per-event Redis Sorted Set."""
        try:
            key_suffix = f"event:{event.id}"
            LeaderboardService.update_score(user.id, key_suffix, score)
        except Exception as e:
            logger.warning("redis_leaderboard_update_failed event=%d err=%s", event.id, e)

    @staticmethod
    def _check_achievements(user, event: Event, participation: Participation) -> None:
        """Awards milestone achievements based on participation stats."""
        milestones = [(10, "10 km"), (50, "50 km"), (100, "100 km")]
        for threshold, label in milestones:
            if participation.total_km >= threshold:
                Achievement.objects.get_or_create(
                    user=user,
                    event=event,
                    achievement_type="MILESTONE_KM",
                    title=f"{label} osiągnięte w {event.title}",
                    defaults={
                        "description": f"Gratulacje! Przebiegłeś/przejechałeś {label} w ramach eventu.",
                        "metadata": {"km_threshold": threshold},
                    },
                )


class EventNormalizationService:
    """
    Computes normalized scores for INTER_TENANT league standings.

    Score = (Total Group KM × Complexity Factor) / Active Participants
    """

    COMPLEXITY_FACTORS = {
        "RUN": 1.2,
        "BIKE": 1.0,
        "WALK": 1.1,
        "ALL": 1.0,
        "RUN_BIKE": 1.0,
        "RUN_BIKE_WALK": 1.0,
    }

    @classmethod
    def get_tenant_score(cls, event: Event, tenant_id: str) -> float:
        """
        Returns normalized score for a tenant in an INTER_TENANT event.

        Args:
            event: The Event instance.
            tenant_id: The city/company tenant ID.

        Returns:
            Normalized float score.
        """
        from django.contrib.auth import get_user_model

        get_user_model()  # ensure custom user model is loaded

        participants = Participation.objects.filter(
            event=event,
            user__tenant_id=tenant_id,
        )
        active_count = participants.count()
        if active_count == 0:
            return 0.0

        total_km = sum(p.total_km for p in participants)
        complexity = cls.COMPLEXITY_FACTORS.get(event.sport_filter, 1.0)
        return (total_km * complexity) / active_count
