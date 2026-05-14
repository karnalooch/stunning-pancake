"""
Events API — SPORT Platform
============================
REST endpoints for the Events Engine (Constitution §21).
Includes OGC API — Moving Features compatible output (Constitution §24.4).
"""
import logging

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Achievement, Event, Participation
from .serializers import (
    AchievementSerializer,
    EventSerializer,
)
from .services import EventNormalizationService

logger = logging.getLogger(__name__)


class EventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for reading Event data.
    Admin-only creation is handled via the Django admin panel.
    """
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Returns active and completed events visible to the user."""
        return Event.objects.filter(
            status__in=['PUBLISHED', 'ACTIVE', 'COMPLETED']
        ).order_by('-start_date')

    @extend_schema(
        summary="Get event leaderboard",
        description="Returns the top-N participants ranked by normalized score.",
        parameters=[
            OpenApiParameter("top_n", int, description="Number of top results (default 20)")
        ],
    )
    @action(detail=True, methods=["get"], url_path="leaderboard")
    def leaderboard(self, request, pk=None):
        """Returns top participants for an event sorted by score."""
        event = self.get_object()
        top_n = int(request.query_params.get("top_n", 20))

        participations = (
            Participation.objects
            .filter(event=event)
            .select_related("user")
            .order_by("-score")[:top_n]
        )

        data = [
            {
                "rank": idx + 1,
                "user_id": p.user_id,
                "username": p.user.username,
                "total_km": round(p.total_km, 2),
                "score": round(p.score, 4),
                "activity_count": p.activity_count,
            }
            for idx, p in enumerate(participations)
        ]
        return Response(data)

    @extend_schema(
        summary="INTER_TENANT normalized standing",
        description=(
            "Returns normalized scores for both tenants in an INTER_TENANT event. "
            "Score = (Total KM × Complexity Factor) / Active Participants. "
            "Constitution §21.2."
        ),
    )
    @action(detail=True, methods=["get"], url_path="tenant-standing")
    def tenant_standing(self, request, pk=None):
        """Normalized city vs city / company vs company score."""
        event = self.get_object()
        if event.event_type != 'INTER_TENANT':
            return Response(
                {"detail": "Only available for INTER_TENANT events."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        score_a = EventNormalizationService.get_tenant_score(event, event.tenant_id)
        score_b = EventNormalizationService.get_tenant_score(event, event.opponent_tenant_id)

        return Response({
            "event_id": event.id,
            "tenant_a": {"id": event.tenant_id, "score": round(score_a, 4)},
            "tenant_b": {"id": event.opponent_tenant_id, "score": round(score_b, 4)},
            "leader": event.tenant_id if score_a >= score_b else event.opponent_tenant_id,
        })

    @extend_schema(
        summary="OGC API — Moving Features: event boundary",
        description=(
            "Returns the event's geofence boundary in OGC-compatible GeoJSON format. "
            "Constitution §24.4: OGC API — Moving Features interoperability."
        ),
    )
    @action(detail=True, methods=["get"], url_path="ogc/boundary")
    def ogc_boundary(self, request, pk=None):
        """
        OGC API — Moving Features compatible boundary endpoint.
        Returns the event boundary polygon as a standard GeoJSON Feature.
        """
        event = self.get_object()
        if not event.boundary:
            return Response(
                {"detail": "This event has no defined boundary."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            "type": "Feature",
            "id": f"event-boundary-{event.id}",
            "properties": {
                "event_id": event.id,
                "title": event.title,
                "event_type": event.event_type,
                "status": event.status,
                "start_date": event.start_date.isoformat(),
                "end_date": event.end_date.isoformat(),
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": list(event.boundary.coords),
            },
        })


class AchievementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for reading a user's earned Achievements.
    """
    serializer_class = AchievementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Returns only the authenticated user's achievements."""
        return Achievement.objects.filter(
            user=self.request.user
        ).select_related("event").order_by("-awarded_at")
