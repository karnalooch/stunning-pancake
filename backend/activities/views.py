from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import Activity, PrivacyZone
from .serializers import ActivitySerializer, ActivityCreateSerializer, PrivacyZoneSerializer

class ActivityViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing sports activities.
    Supports start, update (tracking), and end of sessions.
    """
    serializer_class = ActivitySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Activity.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @extend_schema(
        request=ActivityCreateSerializer,
        responses={201: ActivitySerializer},
        description="Starts a new sports session."
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(
        description="Updates the activity with new GPS points. Expects a LineString or coordinate list."
    )
    @action(detail=True, methods=['patch'])
    def sync_path(self, request, pk=None):
        activity = self.get_object()
        # Logic to append coordinates to route_path will go here
        # For now, we update the whole path
        path_data = request.data.get('route_path')
        if path_data:
            activity.route_path = path_data
            activity.save()
            return Response({"status": "path updated"}, status=status.HTTP_200_OK)
        return Response({"error": "no path data provided"}, status=status.HTTP_400_BAD_REQUEST)

class PrivacyZoneViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user privacy zones.
    Points are masked automatically in the backend during processing.
    """
    serializer_class = PrivacyZoneSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return PrivacyZone.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
