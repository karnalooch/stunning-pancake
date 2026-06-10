"""RODO bulk export (P2 GPX F5) — async ZIP job stub."""

from __future__ import annotations

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_data_export_view(request):
    """
    Queue async export of profile JSON + GPX per activity.
    Full ZIP delivery (S3 link, 24h TTL) — F5 follow-up.
    """
    from users.export_tasks import export_user_data_task

    user = request.user
    export_user_data_task.delay(user.id)

    return Response(
        {
            "status": "queued",
            "message": "RODO export job queued — ZIP with profile.json + GPX per activity.",
            "download_url": None,
            "ttl_hours": 24,
        },
        status=status.HTTP_202_ACCEPTED,
    )
