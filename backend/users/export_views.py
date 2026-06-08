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
    from activities.tasks import generate_gpx_task

    user = request.user
    activity_ids = list(
        user.activities.filter(route_path__isnull=False).values_list("id", flat=True)[:50]
    )
    for aid in activity_ids:
        generate_gpx_task.delay(aid)

    return Response(
        {
            "status": "queued",
            "message": "Export job queued. GPX archive tasks dispatched for recent activities.",
            "activity_count": len(activity_ids),
            "download_url": None,
        },
        status=status.HTTP_202_ACCEPTED,
    )
