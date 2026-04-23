from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import Activity, PrivacyZone, POI, Voucher
from .serializers import ActivitySerializer, ActivityCreateSerializer, PrivacyZoneSerializer

class ActivityViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing sports activities.
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

    @action(detail=True, methods=['patch'])
    def sync_path(self, request, pk=None):
        activity = self.get_object()
        path_data = request.data.get('route_path')
        if path_data:
            activity.route_path = path_data
            activity.save()
            return Response({"status": "path updated"}, status=status.HTTP_200_OK)
        return Response({"error": "no path data provided"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def share_data(self, request, pk=None):
        from .social import SocialSharingService
        activity = self.get_object()
        data = SocialSharingService.generate_activity_card_data(activity)
        return Response(data)

class PrivacyZoneViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user privacy zones.
    """
    serializer_class = PrivacyZoneSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return PrivacyZone.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class VoucherRedeemView(generics.UpdateAPIView):
    """
    Redeem a voucher using its code.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, code):
        try:
            voucher = Voucher.objects.get(code=code, is_redeemed=False)
            voucher.is_redeemed = True
            voucher.redeemed_by = request.user
            voucher.save()
            return Response({
                "status": "voucher redeemed", 
                "value": voucher.discount_value,
                "poi": voucher.poi.name
            })
        except Voucher.DoesNotExist:
            return Response({"error": "invalid or already redeemed voucher"}, status=status.HTTP_400_BAD_REQUEST)

from .services import TelemetryService

class TelemetryLiveView(generics.GenericAPIView):
    """
    Proxy view for fetching live telemetry from Traccar.
    Authorized for Admin roles.
    """
    permission_classes = (permissions.IsAuthenticated,) # Add IsAdminRole here later if needed

    def get(self, request):
        positions = TelemetryService.get_live_positions()
        devices = TelemetryService.get_devices()
        
        # Merge device names into positions for better UI
        device_map = {d['id']: d['name'] for d in devices}
        
        enriched_data = []
        for pos in positions:
            enriched_data.append({
                "deviceId": pos['deviceId'],
                "name": device_map.get(pos['deviceId'], f"Athlete {pos['deviceId']}"),
                "lat": pos['latitude'],
                "lng": pos['longitude'],
                "speed": pos['speed'],
                "course": pos['course'],
                "lastUpdate": pos['deviceTime']
            })
            
        return Response(enriched_data)
