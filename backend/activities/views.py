import json
from rest_framework import viewsets, permissions, status, generics, views
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import Activity, PrivacyZone, Voucher, POI
from .serializers import ActivitySerializer, ActivityCreateSerializer, PrivacyZoneSerializer, POISerializer

from .services import TelemetryService
from .social import SocialSharingService
from .wearables import StravaService, GarminService
from core.redis_cluster import get_redis

class StravaAuthView(views.APIView):
    """
    Returns the Strava OAuth authorization URL.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        url = StravaService.get_auth_url(request.user.id)
        return Response({"auth_url": url})

class StravaCallbackView(views.APIView):
    """
    Handles the Strava OAuth callback.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        code = request.query_params.get('code')
        user_id = request.query_params.get('state')
        
        if not code or not user_id:
            return Response({"error": "missing code or state"}, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
            integration = StravaService.exchange_code(user, code)
            if integration:
                # In a real app, redirect back to the mobile app using deep linking
                return Response({"status": "success", "message": "Strava connected. Your activities will sync soon."})
        except User.DoesNotExist:
            pass
            
        return Response({"error": "connection failed"}, status=status.HTTP_400_BAD_REQUEST)

class GarminAuthView(views.APIView):
    """
    Returns the Garmin OAuth authorization URL.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        url = GarminService.get_auth_url(request.user.id)
        return Response({"auth_url": url})

class GarminCallbackView(views.APIView):
    """
    Handles the Garmin OAuth callback.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        code = request.query_params.get('code')
        user_id = request.query_params.get('state')
        
        if not code or not user_id:
            return Response({"error": "missing code or state"}, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
            integration = GarminService.exchange_code(user, code)
            if integration:
                return Response({"status": "success", "message": "Garmin connected."})
        except User.DoesNotExist:
            pass
            
        return Response({"error": "connection failed"}, status=status.HTTP_400_BAD_REQUEST)

class WearableSyncView(views.APIView):
    """
    Triggers a manual sync for all active wearable integrations.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        integrations = request.user.wearables.filter(is_active=True)
        results = {}
        for integration in integrations:
            if integration.service == 'STRAVA':
                count = StravaService.sync_activities(integration)
                results['STRAVA'] = count
            elif integration.service == 'GARMIN':
                count = GarminService.sync_activities(integration)
                results['GARMIN'] = count
        return Response({"status": "sync complete", "results": results})

class TelemetryConfigView(views.APIView):
    """
    View for getting and setting anti-cheat configuration.
    Stored in Redis for real-time dynamic updates across the cluster.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        r = get_redis()
        config_raw = r.get("telemetry:config")
        if config_raw:
            try:
                return Response(json.loads(config_raw))
            except Exception:
                pass
        
        # Defaults matching the Admin UI state
        return Response({
            "brouterCutoff": 1.5,
            "mlSensitivity": 0.8,
            "autoBan": True
        })

    def post(self, request):
        # Ideally, restrict to GLOBAL_OWNER or TENANT_ADMIN roles here
        r = get_redis()
        config = request.data
        r.set("telemetry:config", json.dumps(config))
        return Response({"status": "ok", "config": config})

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
    Authorized for Admin and Moderator roles.
    """
    permission_classes = (permissions.IsAuthenticated,)


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

    def get(self, request):

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
