import json
import time
from rest_framework import viewsets, permissions, status, generics, views
from rest_framework.decorators import action
from rest_framework.renderers import BaseRenderer
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import Activity, PrivacyZone, Voucher, POI
from .serializers import (
    ActivitySerializer,
    ActivityCreateSerializer,
    PrivacyZoneSerializer,
    POISerializer,
    ActivityDetailSerializer,
)

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
        code = request.query_params.get("code")
        nonce = request.query_params.get("state")

        if not code or not nonce:
            return Response({"error": "missing code or state"}, status=status.HTTP_400_BAD_REQUEST)

        user_id = _resolve_oauth_state(nonce)
        if not user_id:
            return Response(
                {"error": "invalid or expired state"}, status=status.HTTP_400_BAD_REQUEST
            )

        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
            integration = StravaService.exchange_code(user, code)
            if integration:
                # In a real app, redirect back to the mobile app using deep linking
                return Response(
                    {
                        "status": "success",
                        "message": "Strava connected. Your activities will sync soon.",
                    }
                )
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
        code = request.query_params.get("code")
        nonce = request.query_params.get("state")

        if not code or not nonce:
            return Response({"error": "missing code or state"}, status=status.HTTP_400_BAD_REQUEST)

        user_id = _resolve_oauth_state(nonce)
        if not user_id:
            return Response(
                {"error": "invalid or expired state"}, status=status.HTTP_400_BAD_REQUEST
            )

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
            if integration.service == "STRAVA":
                count = StravaService.sync_activities(integration)
                results["STRAVA"] = count
            elif integration.service == "GARMIN":
                count = GarminService.sync_activities(integration)
                results["GARMIN"] = count
        return Response({"status": "sync complete", "results": results})

    def get(self, request):
        """Returns wearable connection status for all services."""
        return Response(
            {
                "strava": StravaService.get_status(request.user),
                "garmin": GarminService.get_status(request.user),
            }
        )


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
        return Response({"brouterCutoff": 1.5, "mlSensitivity": 0.8, "autoBan": True})

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
        description="Starts a new sports session.",
    )
    def create(self, request, *args, **kwargs):
        from events.burst import (
            burst_protection_meta,
            clear_active_session,
            get_active_session_activity_id,
            queue_session_start,
            resolve_event_for_session,
            session_start_rate_limit,
            set_active_session,
        )
        from events.burst import is_burst_enabled_for_event
        from events.tasks import process_event_start_queue

        # Global always-on guard — platform-wide session-start protection that
        # applies whether or not this session belongs to an event.
        try:
            from core.load_guard import check_session_start

            gdecision = check_session_start()
            if not gdecision.allowed:
                resp = Response(
                    {
                        "detail": "Platform session-start rate limit — retry shortly.",
                        "detail_pl": "Globalny limit startu sesji — spróbuj za chwilę.",
                        "queued": False,
                        "global_protection": gdecision.as_meta(),
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
                resp["Retry-After"] = str(gdecision.retry_after)
                return resp
        except Exception:
            pass

        event_id_raw = request.data.get("event_id") or request.query_params.get("event_id")
        event_id = int(event_id_raw) if event_id_raw not in (None, "") else None
        event = resolve_event_for_session(request.user, event_id)

        if event and is_burst_enabled_for_event(event.id, event):
            existing_id = get_active_session_activity_id(event.id, request.user.id)
            if existing_id:
                existing = Activity.objects.filter(
                    pk=existing_id,
                    user=request.user,
                    end_time__isnull=True,
                ).first()
                if existing:
                    serializer = ActivitySerializer(existing)
                    return Response(serializer.data, status=status.HTTP_200_OK)
                clear_active_session(event.id, request.user.id)

            allowed, _, retry_after = session_start_rate_limit(event.id)
            if not allowed:
                position = queue_session_start(
                    event.id,
                    request.user.id,
                    dict(request.data),
                )
                process_event_start_queue.delay(event.id)
                resp = Response(
                    {
                        "detail": "Session start rate limit — queued for retry.",
                        "detail_pl": "Limit startu sesji — kolejka, spróbuj za chwilę.",
                        "queued": True,
                        "queue_position": position,
                        "burst_protection": burst_protection_meta(event, user=request.user),
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
                resp["Retry-After"] = str(retry_after)
                return resp

        response = super().create(request, *args, **kwargs)

        if (
            event
            and is_burst_enabled_for_event(event.id, event)
            and response.status_code in (200, 201)
        ):
            activity_id = response.data.get("id")
            if activity_id:
                set_active_session(event.id, request.user.id, int(activity_id))

        return response

    @action(detail=True, methods=["patch"])
    def sync_path(self, request, pk=None):
        from .route_sync import (
            linestring_from_payload,
            merge_linestrings,
            path_hash_for_coords,
        )

        activity = self.get_object()
        path_data = request.data.get("route_path")
        if not path_data:
            return Response({"error": "no path data provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            incoming = linestring_from_payload(path_data)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        client_hash = request.data.get("path_hash")
        if client_hash:
            try:
                from core.redis_cluster import get_redis

                dedupe_key = f"activity:sync_path_hash:{activity.id}:{client_hash}"
                if not get_redis().set(dedupe_key, "1", nx=True, ex=7 * 24 * 3600):
                    return Response(
                        {"status": "path unchanged", "deduped": True},
                        status=status.HTTP_200_OK,
                    )
            except Exception:
                pass

        merged = merge_linestrings(activity.route_path, incoming)
        server_hash = path_hash_for_coords(list(merged.coords))
        if activity.route_path and server_hash == path_hash_for_coords(
            list(activity.route_path.coords)
        ):
            return Response(
                {"status": "path unchanged", "deduped": True},
                status=status.HTTP_200_OK,
            )

        activity.route_path = merged
        activity.save(update_fields=["route_path"])
        return Response(
            {"status": "path updated", "coords": merged.num_coords},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="finalize")
    def finalize(self, request, pk=None):
        """Idempotent session end — sets end_time/distance and triggers verification."""
        from django.utils import timezone
        from django.utils.dateparse import parse_datetime

        activity = self.get_object()
        if activity.end_time:
            serializer = ActivitySerializer(activity)
            payload = dict(serializer.data)
            payload["post_ride_telemetry"] = {
                "backfill_endpoint": "/api/telemetry/ingest/backfill",
                "backfill_window_min": 30,
                "max_points": 5000,
            }
            return Response(payload, status=status.HTTP_200_OK)

        end_raw = request.data.get("end_time")
        end_time = parse_datetime(end_raw) if end_raw else timezone.now()
        if end_time and timezone.is_naive(end_time):
            end_time = timezone.make_aware(end_time, timezone.get_current_timezone())

        distance = request.data.get("distance")
        if distance is not None:
            activity.distance = float(distance)

        activity.end_time = end_time or timezone.now()
        if activity.start_time and activity.end_time:
            activity.duration = activity.end_time - activity.start_time

        activity.save()
        serializer = ActivitySerializer(activity)
        payload = dict(serializer.data)
        payload["post_ride_telemetry"] = {
            "backfill_endpoint": "/api/telemetry/ingest/backfill",
            "backfill_window_min": 30,
            "max_points": 5000,
            "note": "Late outbox drains may merge via telemetry backfill after finalize.",
        }
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def share_data(self, request, pk=None):
        activity = self.get_object()
        data = SocialSharingService.generate_activity_card_data(activity)
        return Response(data)


class ActivityDetailView(generics.RetrieveAPIView):
    """
    Detailed view of a single activity with user info and route coordinates.
    Admin/moderator roles can view any activity; regular users see only their own.
    """

    queryset = Activity.objects.select_related("user").all()
    serializer_class = ActivityDetailSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        # Admin and moderator roles can view any activity
        if user.role in ("GLOBAL_OWNER", "TENANT_ADMIN", "TENANT_MODERATOR"):
            qs = Activity.objects.select_related("user").all()
            # Tenant-scoped roles only see their tenant's activities
            if user.role in ("TENANT_ADMIN", "TENANT_MODERATOR") and user.tenant_id:
                qs = qs.filter(tenant_id=user.tenant_id)
            return qs
        return Activity.objects.filter(user=user).select_related("user")


class ActivityGpxExportView(ActivityDetailView):
    """
    P2 F1: on-demand GPX download from route_path.
    Same RBAC scope as ActivityDetailView.
    """

    def get(self, request, *args, **kwargs):
        activity = self.get_object()
        if not activity.route_path or activity.route_path.num_coords < 2:
            return Response(
                {"detail": "Activity has no exportable route."},
                status=status.HTTP_404_NOT_FOUND,
            )

        from .gpx_export import linestring_to_gpx

        type_map = {"BIKE": "cycling", "RUN": "running", "WALK": "walking"}
        gpx_type = type_map.get(activity.type, "other")
        gpx_body = linestring_to_gpx(
            activity.route_path,
            track_name=f"Activity {activity.pk}",
            activity_type=gpx_type,
        )

        from django.http import HttpResponse

        response = HttpResponse(gpx_body, content_type="application/gpx+xml")
        response["Content-Disposition"] = f'attachment; filename="activity-{activity.pk}.gpx"'
        return response


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
            return Response(
                {
                    "status": "voucher redeemed",
                    "value": voucher.discount_value,
                    "poi": voucher.poi.name,
                }
            )
        except Voucher.DoesNotExist:
            return Response(
                {"error": "invalid or already redeemed voucher"}, status=status.HTTP_400_BAD_REQUEST
            )


class TelemetryLiveView(generics.GenericAPIView):
    """
    Proxy view for fetching live telemetry from Traccar.
    Authorized for Admin and Moderator roles.
    """

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        from . import simulator_state as sim
        from activities.live_map_api import build_live_map_payload, parse_live_map_query_params
        from activities.telemetry_shard import live_map_read_policy

        sim.maybe_advance_live_simulation_from_poll()
        req = parse_live_map_query_params(request.query_params, user=request.user)
        body = build_live_map_payload(req)
        read_policy = live_map_read_policy()
        resp = Response(body)
        max_age = 1
        if read_policy.ingest_engaged and read_policy.cache_ttl_seconds > 0:
            max_age = read_policy.cache_ttl_seconds
        resp["Cache-Control"] = f"private, max-age={max_age}"
        return resp


class TelemetryLiveReplayView(generics.GenericAPIView):
    """Server replay from Timescale warm path (30d retention)."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        from activities.live_map_replay import build_replay_payload, parse_replay_query_params

        req = parse_replay_query_params(request.query_params, user=request.user)
        if req is None:
            return Response(
                {"detail": "Invalid replay window. Require from, to (ISO), optional step=5s|30s|60s, bbox."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        body = build_replay_payload(req)
        return Response(body)


class TelemetryLiveReplayCompareView(generics.GenericAPIView):
    """Replay + compare vs baseline window (default 24h offset)."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        from activities.live_map_replay import build_compare_payload, parse_replay_query_params

        req = parse_replay_query_params(request.query_params, user=request.user)
        if req is None:
            return Response(
                {"detail": "Invalid replay window. Require from, to (ISO), optional compare_offset=24h."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        body = build_compare_payload(req)
        return Response(body)


class TelemetryLiveAuditView(generics.GenericAPIView):
    """Fire-and-forget live map view audit (rate limited 1/30s per session+bbox)."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        from activities.live_map_audit import record_live_map_view

        result = record_live_map_view(request, request.data if isinstance(request.data, dict) else {})
        return Response(result, status=status.HTTP_202_ACCEPTED)


class LiveMapWebhookListCreateView(generics.ListCreateAPIView):
    """List/create Live Map alert webhooks for tenant."""

    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = None

    def get_serializer_class(self):
        from activities.serializers_webhooks import LiveMapAlertWebhookSerializer

        return LiveMapAlertWebhookSerializer

    def get_queryset(self):
        from activities.models_webhooks import LiveMapAlertWebhook

        user = self.request.user
        qs = LiveMapAlertWebhook.objects.select_related("tenant")
        if getattr(user, "role", "") == "GLOBAL_OWNER":
            tenant_id = self.request.query_params.get("tenant_id")
            if tenant_id:
                qs = qs.filter(tenant_id=tenant_id)
            return qs
        if user.tenant_id:
            return qs.filter(tenant_id=user.tenant_id)
        return LiveMapAlertWebhook.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, "role", "") != "GLOBAL_OWNER":
            serializer.save(tenant_id=user.tenant_id)
        else:
            tenant_id = self.request.data.get("tenant") or self.request.data.get("tenant_id")
            serializer.save(tenant_id=tenant_id or user.tenant_id)


class LiveMapWebhookDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = None

    def get_serializer_class(self):
        from activities.serializers_webhooks import LiveMapAlertWebhookSerializer

        return LiveMapAlertWebhookSerializer

    def get_queryset(self):
        from activities.models_webhooks import LiveMapAlertWebhook

        user = self.request.user
        qs = LiveMapAlertWebhook.objects.all()
        if getattr(user, "role", "") == "GLOBAL_OWNER":
            return qs
        if user.tenant_id:
            return qs.filter(tenant_id=user.tenant_id)
        return LiveMapAlertWebhook.objects.none()


class LiveMapWebhookTestView(generics.GenericAPIView):
    """Send test_ping to configured webhook URL."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        import uuid

        from activities.models_webhooks import LiveMapAlertWebhook
        from activities.tasks import deliver_live_map_webhook

        user = request.user
        qs = LiveMapAlertWebhook.objects.filter(pk=pk, enabled=True)
        if getattr(user, "role", "") != "GLOBAL_OWNER" and user.tenant_id:
            qs = qs.filter(tenant_id=user.tenant_id)
        wh = qs.first()
        if not wh:
            return Response({"detail": "Webhook not found."}, status=status.HTTP_404_NOT_FOUND)

        event_id = str(uuid.uuid4())
        payload = {
            "event": "test_ping",
            "event_id": event_id,
            "tenant_id": str(wh.tenant_id),
            "timestamp": time.time(),
            "meta": {"message": "Live Map webhook test"},
        }
        deliver_live_map_webhook.delay(wh.id, event_id, payload)
        return Response({"status": "queued", "event_id": event_id}, status=status.HTTP_202_ACCEPTED)


class EventStreamRenderer(BaseRenderer):
    """Allow DRF content negotiation for Accept: text/event-stream (SSE)."""

    media_type = "text/event-stream"
    format = "event-stream"
    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b""
        if isinstance(data, (bytes, bytearray)):
            return bytes(data)
        if isinstance(data, str):
            return data.encode()
        return json.dumps(data).encode()


class TelemetryLiveStreamView(views.APIView):
    """
    SSE stream of live map snapshots (200–500 ms cadence at street zoom).
    Same auth and query params as TelemetryLiveView; not available for detail=summary.
    """

    permission_classes = (permissions.IsAuthenticated,)
    renderer_classes = (EventStreamRenderer,)

    def get(self, request):
        from django.http import StreamingHttpResponse

        from . import simulator_state as sim
        from activities.live_map_api import (
            build_live_map_payload,
            parse_live_map_query_params,
            stream_interval_ms,
        )
        from activities.telemetry_shard import live_map_read_policy

        req = parse_live_map_query_params(
            request.query_params, user=request.user, default_skip_cache=True
        )
        if req.detail == "summary":
            return Response(
                {"detail": "Live stream unavailable at country summary zoom."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        read_policy = live_map_read_policy()
        interval_s = (
            stream_interval_ms(
                req.zoom_param,
                read_policy.ingest_engaged,
                read_policy.poll_interval_multiplier if read_policy.ingest_engaged else 1.0,
            )
            / 1000.0
        )

        def event_stream():
            try:
                while True:
                    sim.maybe_advance_live_simulation_from_poll()
                    payload = build_live_map_payload(req)
                    payload["meta"]["transport"] = "sse"
                    yield f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"
                    time.sleep(interval_s)
            except GeneratorExit:
                pass

        resp = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        resp["Cache-Control"] = "no-cache, no-store"
        resp["X-Accel-Buffering"] = "no"
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
        tenant_id = (
            request.user.tenant_id
            if hasattr(request.user, "tenant_id")
            and getattr(request.user, "role", "") != "GLOBAL_OWNER"
            else None
        )

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

        scope = self.request.query_params.get("scope", "CITY")

        qs = User.objects.filter(role="ATHLETE")
        if scope == "CITY" and self.request.user.tenant_id:
            qs = qs.filter(tenant_id=self.request.user.tenant_id)

        ranking = qs.annotate(
            total_distance=Sum(
                "activity__distance",
                filter=Q(activity__is_verified=True),
            )
        ).order_by("-total_distance")[:100]

        result = []
        for i, u in enumerate(ranking):
            result.append(
                {
                    "rank": i + 1,
                    "username": u.username,
                    "points": int((u.total_distance or 0) / 10),  # 1 XP per 10m
                    "is_me": u.id == self.request.user.id,
                }
            )

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
        if requesting_user.role != "GLOBAL_OWNER" and requesting_user.tenant_id:
            return self.queryset.filter(tenant_id=requesting_user.tenant_id)
        return self.queryset

    def get_permissions(self):
        # Restrict write operations to GLOBAL_OWNER, TENANT_ADMIN, and SPONSOR
        if self.action in ["create", "update", "partial_update", "destroy"]:

            class IsPOIAdminOrSponsor(permissions.BasePermission):
                def has_permission(self, request, view):
                    role = getattr(request.user, "role", None)
                    return request.user.is_authenticated and role in (
                        "GLOBAL_OWNER",
                        "TENANT_ADMIN",
                        "SPONSOR",
                    )

            return [IsPOIAdminOrSponsor()]
        return super().get_permissions()

    def perform_create(self, serializer):
        # Automatically assign tenant_id if user is not GLOBAL_OWNER
        requesting_user = self.request.user
        if requesting_user.role != "GLOBAL_OWNER":
            serializer.save(tenant_id=requesting_user.tenant_id)
        else:
            # For GLOBAL_OWNER, allow setting tenant_id or default to None
            tenant_id = self.request.data.get("tenant_id")
            serializer.save(tenant_id=tenant_id)

    def perform_update(self, serializer):
        # Check tenant isolation
        requesting_user = self.request.user
        instance = self.get_object()
        if requesting_user.role != "GLOBAL_OWNER":
            if instance.tenant_id != requesting_user.tenant_id:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("You cannot update POIs outside of your tenant.")
            serializer.save(tenant_id=requesting_user.tenant_id)
        else:
            tenant_id = self.request.data.get("tenant_id", instance.tenant_id)
            serializer.save(tenant_id=tenant_id)

    def perform_destroy(self, instance):
        requesting_user = self.request.user
        if (
            requesting_user.role != "GLOBAL_OWNER"
            and instance.tenant_id != requesting_user.tenant_id
        ):
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
        {
            "type": "positive",
            "title": "Platform Health",
            "desc": f"{pct}% verified ({verified}/{total})",
            "color": "green",
        },
        {
            "type": "warning",
            "title": "Pending Review",
            "desc": f"{anomalies} low-score activities need attention",
            "color": "orange",
        },
        {
            "type": "positive",
            "title": "Activity Count",
            "desc": f"{total} total activities recorded",
            "color": "indigo",
        },
    ]
