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

from .burst import burst_protection_meta, join_event
from .models import Achievement, Event, Participation
from .serializers import (
    AchievementSerializer,
    EventSerializer,
    ParticipationSerializer,
)
from .services import EventNormalizationService

logger = logging.getLogger(__name__)


class EventViewSet(viewsets.ModelViewSet):
    """
    ViewSet for reading and managing Event data.
    """

    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Returns events scoped by permission and role."""
        user = self.request.user
        if not user.is_authenticated:
            return Event.objects.none()

        if user.role == "GLOBAL_OWNER":
            return Event.objects.all().order_by("-start_date")

        if user.role == "TENANT_ADMIN":
            from django.db.models import Q

            return Event.objects.filter(
                Q(tenant_id=user.tenant_id) | Q(status__in=["PUBLISHED", "ACTIVE", "COMPLETED"])
            ).order_by("-start_date")

        # Standard user
        if user.tenant_id:
            from django.db.models import Q

            return (
                Event.objects.filter(Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True))
                .filter(status__in=["PUBLISHED", "ACTIVE", "COMPLETED"])
                .order_by("-start_date")
            )

        return Event.objects.filter(status__in=["PUBLISHED", "ACTIVE", "COMPLETED"]).order_by(
            "-start_date"
        )

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            from users.permissions import IsTenantAdmin

            return [IsTenantAdmin()]
        return super().get_permissions()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == "list":
            ctx["burst_lightweight"] = True
        return ctx

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != "GLOBAL_OWNER":
            serializer.save(tenant_id=user.tenant_id, created_by=user)
        else:
            serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()
        if user.role != "GLOBAL_OWNER":
            if instance.tenant_id != user.tenant_id:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("You cannot update events outside of your tenant.")
            serializer.save(tenant_id=user.tenant_id)
        else:
            serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role != "GLOBAL_OWNER" and instance.tenant_id != user.tenant_id:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You cannot delete events outside of your tenant.")
        instance.delete()

    @extend_schema(
        summary="Join event",
        description=(
            "Register the authenticated user for an event. Idempotent: already joined returns 200. "
            "Large or high-load events may return 429 with Retry-After when burst protection is active."
        ),
        responses={
            200: ParticipationSerializer,
            201: ParticipationSerializer,
            429: {"description": "Join rate limit exceeded"},
        },
    )
    @action(detail=True, methods=["post"], url_path="join")
    def join(self, request, pk=None):
        """Join or re-confirm participation in an event."""
        event = self.get_object()
        if event.status not in ("PUBLISHED", "ACTIVE"):
            return Response(
                {"detail": "Event is not open for participation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        participation, created, err = join_event(request.user, event)
        if err:
            resp = Response(
                {
                    "detail": err["detail"],
                    "detail_pl": err.get("detail_pl"),
                    "burst_protection": burst_protection_meta(event, user=request.user),
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
            resp["Retry-After"] = str(err["retry_after"])
            return resp

        serializer = ParticipationSerializer(participation)
        data = serializer.data
        data["burst_protection"] = burst_protection_meta(event, user=request.user)
        return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

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
            Participation.objects.filter(event=event)
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
        if event.event_type != "INTER_TENANT":
            return Response(
                {"detail": "Only available for INTER_TENANT events."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        score_a = EventNormalizationService.get_tenant_score(event, event.tenant_id)
        score_b = EventNormalizationService.get_tenant_score(event, event.opponent_tenant_id)

        return Response(
            {
                "event_id": event.id,
                "tenant_a": {"id": event.tenant_id, "score": round(score_a, 4)},
                "tenant_b": {"id": event.opponent_tenant_id, "score": round(score_b, 4)},
                "leader": event.tenant_id if score_a >= score_b else event.opponent_tenant_id,
            }
        )

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

        return Response(
            {
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
            }
        )


class AchievementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for reading a user's earned Achievements.
    """

    serializer_class = AchievementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Returns only the authenticated user's achievements."""
        return (
            Achievement.objects.filter(user=self.request.user)
            .select_related("event")
            .order_by("-awarded_at")
        )
