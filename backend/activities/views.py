from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import Activity, PrivacyZone, Voucher
from .serializers import ActivitySerializer, ActivityCreateSerializer, PrivacyZoneSerializer
from .services import TelemetryService
from .social import SocialSharingService

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


class TelemetryLiveView(generics.GenericAPIView):
    """
    Proxy view for fetching live telemetry from Traccar.
    Authorized for Admin roles.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        positions = TelemetryService.get_live_positions()
        devices = TelemetryService.get_devices()
        
        # Ensure we have lists to work with
        if not isinstance(positions, list):
            positions = []
        if not isinstance(devices, list):
            devices = []
            
        # Merge device names and types into positions for better UI
        device_info = {d.get('id'): {'name': d.get('name'), 'type': d.get('category')} for d in devices if isinstance(d, dict)}
        
        enriched_data = []
        for pos in positions:
            if not isinstance(pos, dict):
                continue
                
            device_id = pos.get('deviceId')
            if device_id is None:
                continue
            
            info = device_info.get(device_id, {})
            enriched_data.append({
                "deviceId": device_id,
                "name": info.get('name', f"Athlete {device_id}"),
                "type": info.get('type', 'person'),
                "lat": pos.get('latitude', 0.0),
                "lng": pos.get('longitude', 0.0),
                "speed": pos.get('speed', 0.0),
                "course": pos.get('course', 0.0),
                "lastUpdate": pos.get('deviceTime')
            })

            
        return Response(enriched_data)

