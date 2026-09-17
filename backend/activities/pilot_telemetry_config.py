"""Pilot-safe authorization wrapper for platform-wide telemetry configuration."""

from rest_framework import status
from rest_framework.response import Response

from .views import TelemetryConfigView


class PilotSafeTelemetryConfigView(TelemetryConfigView):
    """Keep reads authenticated but reserve global anti-cheat mutation to owner."""

    def post(self, request):
        if getattr(request.user, "role", None) != "GLOBAL_OWNER":
            return Response(
                {"detail": "Only the platform owner may change anti-cheat config."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().post(request)
