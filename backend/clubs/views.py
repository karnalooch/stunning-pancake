from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from users.audit import record_audit_event

from .models import Club, ClubChallenge, ClubMembership
from .serializers import (
    ClubChallengeSerializer,
    ClubCreateSerializer,
    ClubMembershipSerializer,
    ClubSerializer,
)


def scoped_clubs_for(user):
    """Return clubs visible inside the caller's tenant boundary."""
    clubs = Club.objects.all()
    if getattr(user, "role", None) == "GLOBAL_OWNER":
        return clubs
    tenant_id = getattr(user, "tenant_id", None)
    if tenant_id is None:
        return clubs.none()
    return clubs.filter(tenant_id=str(tenant_id))


def scoped_memberships_for(user, club):
    """Return memberships that cannot disclose a foreign-tenant user."""
    memberships = ClubMembership.objects.filter(club=club)
    if getattr(user, "role", None) == "GLOBAL_OWNER":
        return memberships
    tenant_id = getattr(user, "tenant_id", None)
    if tenant_id is None:
        return memberships.none()
    return memberships.filter(user__tenant_id=tenant_id)


class ClubListCreateView(generics.ListCreateAPIView):
    queryset = Club.objects.all().order_by("-created_at")
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return ClubCreateSerializer if self.request.method == "POST" else ClubSerializer

    def get_queryset(self):
        clubs = scoped_clubs_for(self.request.user).order_by("-created_at")
        sport = self.request.query_params.get("sport_type")
        if sport:
            clubs = clubs.filter(sport_type=sport)
        return clubs


class ClubDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ClubSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return scoped_clubs_for(self.request.user)

    def update(self, request, *args, **kwargs):
        club = self.get_object()
        if club.owner != request.user:
            return Response({"error": "Only the owner can edit this club."}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        club = self.get_object()
        if club.owner != request.user:
            return Response({"error": "Only the owner can delete this club."}, status=403)
        return super().destroy(request, *args, **kwargs)


class ClubMembersView(generics.ListAPIView):
    serializer_class = ClubMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        club = get_object_or_404(scoped_clubs_for(self.request.user), pk=self.kwargs["pk"])
        return (
            scoped_memberships_for(self.request.user, club)
            .filter(status="ACTIVE")
            .select_related("user")
        )


@extend_schema(responses={200: {"type": "object"}})
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def join_club(request, pk):
    club = get_object_or_404(scoped_clubs_for(request.user), pk=pk)
    membership, created = ClubMembership.objects.get_or_create(
        club=club,
        user=request.user,
        defaults={"status": "ACTIVE"},
    )
    state_changed = created
    if not created and membership.status != "ACTIVE":
        membership.status = "ACTIVE"
        membership.save(update_fields=["status"])
        state_changed = True
    if state_changed:
        record_audit_event(
            actor=request.user,
            target_user=request.user,
            tenant_id=club.tenant_id,
            action="club_membership.joined",
            status_code=200,
            request=request,
            details={"club_id": club.id, "membership_id": membership.id},
        )
    return Response({"status": "joined", "club": club.name})


@extend_schema(responses={200: {"type": "object"}})
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def leave_club(request, pk):
    club = get_object_or_404(scoped_clubs_for(request.user), pk=pk)
    try:
        membership = ClubMembership.objects.get(club=club, user=request.user)
        membership_id = membership.id
        membership.delete()
        record_audit_event(
            actor=request.user,
            target_user=request.user,
            tenant_id=club.tenant_id,
            action="club_membership.left",
            status_code=200,
            request=request,
            details={"club_id": club.id, "membership_id": membership_id},
        )
        return Response({"status": "left"})
    except ClubMembership.DoesNotExist:
        return Response({"error": "Not a member."}, status=status.HTTP_404_NOT_FOUND)


class ClubChallengeListCreateView(generics.ListCreateAPIView):
    serializer_class = ClubChallengeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        challenges = ClubChallenge.objects.filter(status__in=["PENDING", "ACTIVE"])
        if getattr(self.request.user, "role", None) != "GLOBAL_OWNER":
            tenant_id = getattr(self.request.user, "tenant_id", None)
            if tenant_id is None:
                return challenges.none()
            tenant_id = str(tenant_id)
            challenges = challenges.filter(
                challenger__tenant_id=tenant_id,
                opponent__tenant_id=tenant_id,
            )
        return challenges.order_by("-created_at")


class ClubLeaderboardView(generics.ListAPIView):
    serializer_class = ClubMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        club = get_object_or_404(scoped_clubs_for(self.request.user), pk=self.kwargs["pk"])
        return (
            scoped_memberships_for(self.request.user, club)
            .filter(status="ACTIVE")
            .order_by("-total_km")
            .select_related("user")[:10]
        )
