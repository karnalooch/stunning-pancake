"""Pilot-safe profile mutations that preserve tenant isolation."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response

from .models import Role, Tenant
from .views import UserProfileView


class PilotSafeUserProfileView(UserProfileView):
    """Allow initial athlete city selection but forbid self-service tenant transfer.

    Mobile onboarding needs one self-service transition from ``tenant=NULL`` to
    an active tenant. After that, tenant membership is security-sensitive state:
    moving between tenants must use an audited administrative/transfer flow.
    Privileged roles may never alter their own tenant through the profile API.
    """

    def _tenant_change_guard(self, request):
        if "tenant_id" not in request.data:
            return None

        user = request.user
        requested_tenant_id = request.data.get("tenant_id")
        current_tenant_id = getattr(user, "tenant_id", None)

        if getattr(user, "role", None) != Role.ATHLETE:
            return Response(
                {"detail": "Tenant changes require an administrative flow."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if requested_tenant_id in (None, ""):
            return Response(
                {"detail": "Tenant membership cannot be cleared through profile."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if current_tenant_id is not None:
            if str(current_tenant_id) != str(requested_tenant_id):
                return Response(
                    {"detail": "Tenant transfer requires administrative approval."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return None

        if not Tenant.objects.filter(pk=requested_tenant_id, is_active=True).exists():
            return Response(
                {"detail": "Selected tenant is not available."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return None

    def patch(self, request, *args, **kwargs):
        blocked = self._tenant_change_guard(request)
        if blocked is not None:
            return blocked
        return super().patch(request, *args, **kwargs)

    def put(self, request, *args, **kwargs):
        blocked = self._tenant_change_guard(request)
        if blocked is not None:
            return blocked
        return super().put(request, *args, **kwargs)
