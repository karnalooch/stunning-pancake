from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import IsTenantAdmin

from .models import PlatformNotice
from .notice_serializers import ActivePlatformNoticeSerializer, PlatformNoticeSerializer


def _active_notices_queryset(tenant_id=None):
    now = timezone.now()
    qs = PlatformNotice.objects.filter(
        is_active=True,
        starts_at__lte=now,
    ).filter(Q(ends_at__isnull=True) | Q(ends_at__gte=now))
    if tenant_id:
        qs = qs.filter(Q(tenant_id=tenant_id) | Q(tenant__isnull=True))
    else:
        qs = qs.filter(tenant__isnull=True)
    return qs.order_by("-severity", "-starts_at")


class ActivePlatformNoticesView(APIView):
    """Public/authenticated read of active notices for mobile banner."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        tenant_id = request.query_params.get("tenant_id")
        qs = _active_notices_queryset(tenant_id=tenant_id or None)
        serializer = ActivePlatformNoticeSerializer(qs[:5], many=True)
        return Response({"notices": serializer.data})


class PlatformNoticeViewSet(viewsets.ModelViewSet):
    queryset = PlatformNotice.objects.select_related("tenant").all()
    serializer_class = PlatformNoticeSerializer

    def get_permissions(self):
        return [permissions.IsAuthenticated(), IsTenantAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = getattr(user, "role", None)
        if role == "GLOBAL_OWNER":
            return qs
        tenant_id = getattr(user, "tenant_id", None)
        return qs.filter(Q(tenant_id=tenant_id) | Q(tenant__isnull=True))

    def perform_create(self, serializer):
        user = self.request.user
        role = getattr(user, "role", None)
        if role != "GLOBAL_OWNER":
            serializer.save(tenant_id=getattr(user, "tenant_id", None))
            return
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        role = getattr(user, "role", None)
        instance = serializer.instance
        if role != "GLOBAL_OWNER":
            if instance.tenant_id is None:
                raise PermissionDenied("Only platform owner can edit global notices.")
            serializer.save(tenant_id=getattr(user, "tenant_id", None))
            return
        serializer.save()

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        notice = self.get_object()
        notice.is_active = True
        notice.save(update_fields=["is_active", "updated_at"])
        return Response(self.get_serializer(notice).data)

    @action(detail=True, methods=["post"], url_path="unpublish")
    def unpublish(self, request, pk=None):
        notice = self.get_object()
        notice.is_active = False
        notice.save(update_fields=["is_active", "updated_at"])
        return Response(self.get_serializer(notice).data, status=status.HTTP_200_OK)
