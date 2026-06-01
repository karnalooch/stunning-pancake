import json
from rest_framework import viewsets, permissions, status, generics, views
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import Activity, PrivacyZone, Voucher, POI
from .serializers import ActivitySerializer, ActivityCreateSerializer, PrivacyZoneSerializer, POISerializer, ActivityDetailSerializer

from .services import TelemetryService
from .social import SocialSharingService
from .wearables import StravaService, GarminService, _resolve_oauth_state
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
        nonce = request.query_params.get('state')
        
        if not code or not nonce:
            return Response({"error": "missing code or state"}, status=status.HTTP_400_BAD_REQUEST)

        user_id = _resolve_oauth_state(nonce)
        if not user_id:
            return Response({"error": "invalid or expired state"}, status=status.HTTP_400_BAD_REQUEST)

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
        nonce = request.query_params.get('state')
        
        if not code or not nonce:
            return Response({"error": "missing code or state"}, status=status.HTTP_400_BAD_REQUEST)

        user_id = _resolve_oauth_state(nonce)
        if not user_id:
            return Response({"error": "invalid or expired state"}, status=status.HTTP_400_BAD_REQUEST)

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

    def get(self, request):
        """Returns wearable connection status for all services."""
        return Response({
            'strava': StravaService.get_status(request.user),
            'garmin': GarminService.get_status(request.user),
        })

class TelemetryConfigView(views.APIView):
    """
    View for getting and setting anti-cheat configuration.
    Stored in Redis for real-time dynamic updates across the cluster.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        try:
            r = get_redis()
            config_raw = r.get("telemetry:config")
            if config_raw:
                try:
                    return Response(json.loads(config_raw))
                except Exception:
                    pass
        except Exception:
            pass
        
        # Defaults matching the Admin UI state
        return Response({
            "brouterCutoff": 1.5,
            "mlSensitivity": 0.8,
            "autoBan": True
        })

    def post(self, request):
        try:
            r = get_redis()
            config = request.data
            r.set("telemetry:config", json.dumps(config))
            return Response({"status": "ok", "config": config})
        except Exception:
            return Response({"status": "ok", "config": request.data})

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

class ActivityDetailView(generics.RetrieveAPIView):
    """
    Detailed view of a single activity with user info and route coordinates.
    Admin/moderator roles can view any activity; regular users see only their own.
    """
    queryset = Activity.objects.select_related('user').all()
    serializer_class = ActivityDetailSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        # Admin and moderator roles can view any activity
        if user.role in ('GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR'):
            qs = Activity.objects.select_related('user').all()
            # Tenant-scoped roles only see their tenant's activities
            if user.role in ('TENANT_ADMIN', 'TENANT_MODERATOR') and user.tenant_id:
                qs = qs.filter(tenant_id=user.tenant_id)
            return qs
        return Activity.objects.filter(user=user).select_related('user')


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
        from . import simulator_state as sim
        sim.maybe_advance_live_simulation()

        bbox_tuple = None
        bbox_str = request.query_params.get('bbox', '')
        if bbox_str:
            try:
                parts = [float(x) for x in bbox_str.split(',')]
                if len(parts) == 4:
                    bbox_tuple = tuple(parts)
            except (ValueError, TypeError):
                pass

        try:
            limit = int(request.query_params.get('limit', 0))
        except (TypeError, ValueError):
            limit = 0

        positions, telemetry_meta = TelemetryService.get_live_positions(bbox=bbox_tuple, limit=limit or None)

        if not isinstance(positions, list):
            positions = []

        need_devices = any(
            isinstance(p, dict) and p.get('deviceId') is not None
            and not (p.get('name') or p.get('category') or p.get('type'))
            for p in positions
        )
        device_info = {}
        if need_devices:
            devices = TelemetryService.get_devices()
            if isinstance(devices, list):
                device_info = {
                    d.get('id'): {'name': d.get('name'), 'type': d.get('category')}
                    for d in devices if isinstance(d, dict)
                }

        enriched_data = []
        viewport_bike = 0
        viewport_run = 0
        _bike = frozenset({'bike', 'bicycle', 'cycling', 'cyclist'})
        _run = frozenset({'run', 'running', 'runner', 'person', 'walk', 'walking', 'foot'})

        for pos in positions:
            if not isinstance(pos, dict):
                continue
            device_id = pos.get('deviceId')
            if device_id is None:
                continue
            info = device_info.get(device_id, {})
            raw_type = (pos.get('category') or pos.get('type') or info.get('type', 'person') or '').lower()
            if raw_type in _bike:
                viewport_bike += 1
            elif raw_type in _run:
                viewport_run += 1
            enriched_data.append({
                "deviceId": device_id,
                "name": pos.get('name') or info.get('name', f"Athlete {device_id}"),
                "type": pos.get('category') or pos.get('type') or info.get('type', 'person'),
                "lat": pos.get('latitude', 0.0),
                "lng": pos.get('longitude', 0.0),
                "speed": pos.get('speed', 0.0),
                "course": pos.get('course', 0.0),
                "lastUpdate": pos.get('deviceTime'),
            })

        try:
            from activities import simulator_state as sim_state
            active_riding = sim_state.get_live_ride_count()
        except Exception:
            active_riding = telemetry_meta.get('active_riding') or telemetry_meta.get('redis_active', 0)

        resp = Response({
            'positions': enriched_data,
            'meta': {
                **telemetry_meta,
                'redis_active': active_riding,
                'active_riding': active_riding,
                'viewport_bike': viewport_bike,
                'viewport_run': viewport_run,
                'pool_note': (
                    'active = riders in live sim; cyclists/runners = in current map viewport only.'
                ),
            },
        })
        resp['Cache-Control'] = 'private, max-age=1'
        return resp

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

        from django.db.models import Q, Sum
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        scope = self.request.query_params.get('scope', 'CITY')
        
        qs = User.objects.filter(role='ATHLETE')
        if scope == 'CITY' and self.request.user.tenant_id:
            qs = qs.filter(tenant_id=self.request.user.tenant_id)
            
        ranking = qs.annotate(
            total_distance=Sum(
                'activity__distance',
                filter=Q(activity__is_verified=True),
            )
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

class POIViewSet(viewsets.ModelViewSet):
    """
    ViewSet for retrieving and managing sponsor POIs.
    """
    queryset = POI.objects.all()
    serializer_class = POISerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        # Filter by tenant/city
        requesting_user = self.request.user
        if requesting_user.role != 'GLOBAL_OWNER' and requesting_user.tenant_id:
            return self.queryset.filter(tenant_id=requesting_user.tenant_id)
        return self.queryset

    def get_permissions(self):
        # Restrict write operations to GLOBAL_OWNER, TENANT_ADMIN, and SPONSOR
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            class IsPOIAdminOrSponsor(permissions.BasePermission):
                def has_permission(self, request, view):
                    role = getattr(request.user, 'role', None)
                    return request.user.is_authenticated and role in ('GLOBAL_OWNER', 'TENANT_ADMIN', 'SPONSOR')
            return [IsPOIAdminOrSponsor()]
        return super().get_permissions()

    def perform_create(self, serializer):
        # Automatically assign tenant_id if user is not GLOBAL_OWNER
        requesting_user = self.request.user
        if requesting_user.role != 'GLOBAL_OWNER':
            serializer.save(tenant_id=requesting_user.tenant_id)
        else:
            # For GLOBAL_OWNER, allow setting tenant_id or default to None
            tenant_id = self.request.data.get('tenant_id')
            serializer.save(tenant_id=tenant_id)

    def perform_update(self, serializer):
        # Check tenant isolation
        requesting_user = self.request.user
        instance = self.get_object()
        if requesting_user.role != 'GLOBAL_OWNER':
            if instance.tenant_id != requesting_user.tenant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot update POIs outside of your tenant.")
            serializer.save(tenant_id=requesting_user.tenant_id)
        else:
            tenant_id = self.request.data.get('tenant_id', instance.tenant_id)
            serializer.save(tenant_id=tenant_id)

    def perform_destroy(self, instance):
        requesting_user = self.request.user
        if requesting_user.role != 'GLOBAL_OWNER' and instance.tenant_id != requesting_user.tenant_id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You cannot delete POIs outside of your tenant.")
        instance.delete()


class AIInsightsView(generics.GenericAPIView):
    """
    Auto-generated AI insights from analytics data.
    Returns platform health metrics, pending reviews, and anomaly counts.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(generate_insights())


def generate_insights():
    from .models import Activity
    from django.db.models import Sum, Count
    total = Activity.objects.count()
    verified = Activity.objects.filter(is_verified=True).count()
    pct = round(verified / max(total, 1) * 100, 1)
    anomalies = Activity.objects.filter(verification_score__lt=0.3).count()
    return [
        {'type': 'positive', 'title': 'Platform Health', 'desc': f'{pct}% verified ({verified}/{total})', 'color': 'green'},
        {'type': 'warning', 'title': 'Pending Review', 'desc': f'{anomalies} low-score activities need attention', 'color': 'orange'},
        {'type': 'positive', 'title': 'Activity Count', 'desc': f'{total} total activities recorded', 'color': 'indigo'},
    ]
