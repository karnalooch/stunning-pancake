from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter
from .models import Club, ClubMembership, ClubChallenge
from .serializers import (
    ClubSerializer,
    ClubCreateSerializer,
    ClubMembershipSerializer,
    ClubChallengeSerializer,
)


class ClubListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/clubs/           — List all clubs (filterable by sport_type).
    POST /api/clubs/           — Create a new club (owner = request.user).
    """

    queryset = Club.objects.all().order_by('-created_at')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return ClubCreateSerializer if self.request.method == 'POST' else ClubSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        sport = self.request.query_params.get('sport_type')
        if sport:
            qs = qs.filter(sport_type=sport)
        return qs


class ClubDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/clubs/<id>/    — Retrieve club details.
    PATCH  /api/clubs/<id>/    — Update club (owner only).
    DELETE /api/clubs/<id>/    — Delete club (owner only).
    """

    queryset = Club.objects.all()
    serializer_class = ClubSerializer

    def get_permissions(self):
        if self.request.method in ('PATCH', 'DELETE'):
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def update(self, request, *args, **kwargs):
        club = self.get_object()
        if club.owner != request.user:
            return Response({'error': 'Only the owner can edit this club.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        club = self.get_object()
        if club.owner != request.user:
            return Response({'error': 'Only the owner can delete this club.'}, status=403)
        return super().destroy(request, *args, **kwargs)


class ClubMembersView(generics.ListAPIView):
    """GET /api/clubs/<id>/members/ — List active members with stats."""

    serializer_class = ClubMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ClubMembership.objects.filter(
            club_id=self.kwargs['pk'], status='ACTIVE'
        ).select_related('user')


@extend_schema(responses={200: {'type': 'object'}})
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def join_club(request, pk):
    """
    POST /api/clubs/<id>/join/  — Join a club as an ACTIVE member.

    Idempotent: rejoining a club sets status back to ACTIVE.
    """
    try:
        club = Club.objects.get(pk=pk)
    except Club.DoesNotExist:
        return Response({'error': 'Club not found.'}, status=status.HTTP_404_NOT_FOUND)

    membership, created = ClubMembership.objects.get_or_create(
        club=club,
        user=request.user,
        defaults={'status': 'ACTIVE'},
    )
    if not created and membership.status != 'ACTIVE':
        membership.status = 'ACTIVE'
        membership.save()

    return Response({'status': 'joined', 'club': club.name})


@extend_schema(responses={200: {'type': 'object'}})
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def leave_club(request, pk):
    """POST /api/clubs/<id>/leave/ — Leave a club."""
    try:
        membership = ClubMembership.objects.get(club_id=pk, user=request.user)
        membership.delete()
        return Response({'status': 'left'})
    except ClubMembership.DoesNotExist:
        return Response({'error': 'Not a member.'}, status=status.HTTP_404_NOT_FOUND)


class ClubChallengeListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/clubs/challenges/   — List all active challenges.
    POST /api/clubs/challenges/   — Create a new challenge.
    """

    queryset = ClubChallenge.objects.filter(status__in=['PENDING', 'ACTIVE']).order_by('-created_at')
    serializer_class = ClubChallengeSerializer
    permission_classes = [permissions.IsAuthenticated]


class ClubLeaderboardView(generics.ListAPIView):
    """GET /api/clubs/<id>/leaderboard/ — Top members by total_km."""

    serializer_class = ClubMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ClubMembership.objects.filter(
            club_id=self.kwargs['pk'], status='ACTIVE'
        ).order_by('-total_km').select_related('user')[:10]
