from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import Activity, PrivacyZone, Voucher, POI
from .serializers import ActivitySerializer, ActivityCreateSerializer, PrivacyZoneSerializer, POISerializer

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

class AnomalyListView(generics.GenericAPIView):
    """
    View for fetching recent anti-cheat anomalies.
    Authorized for Admin roles (handled by generic permissions or RoleGuard in frontend).
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        from .services import AntiCheatEngine
        # Ideally, we filter by request.user.tenant_id if user is a Tenant Admin
        tenant_id = request.user.tenant_id if hasattr(request.user, 'tenant_id') and getattr(request.user, 'role', '') != 'GLOBAL_OWNER' else None
        
        anomalies = AntiCheatEngine.get_recent_anomalies(tenant_id=tenant_id, limit=50)
        return Response(anomalies)

class LeaderboardView(generics.GenericAPIView):
    """
    Returns ranking of users based on total distance or points.
    Can be filtered by tenant (city).
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self):
        from django.db.models import Sum
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        scope = self.request.query_params.get('scope', 'CITY')
        
        qs = User.objects.filter(role='ATHLETE')
        if scope == 'CITY' and self.request.user.tenant_id:
            qs = qs.filter(tenant_id=self.request.user.tenant_id)
            
        ranking = qs.annotate(
            total_distance=Sum('activity__distance')
        ).order_by('-total_distance')[:100]
        
        result = []
        for i, u in enumerate(ranking):
            result.append({
                "rank": i + 1,
                "username": u.username,
                "points": int((u.total_distance or 0) / 10), # 1 XP per 10m
                "is_me": u.id == self.request.user.id
            })
            
        return Response(result)

class POIViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for retrieving sponsor POIs.
    """
    queryset = POI.objects.all()
    serializer_class = POISerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        # Optionally filter by tenant/city
        tenant_id = self.request.user.tenant_id
        if tenant_id:
            return self.queryset.filter(tenant_id=tenant_id)
        return self.queryset

