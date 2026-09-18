"""RODO bulk export (P2 GPX F5)."""

from __future__ import annotations

import logging
import uuid

from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.export_models import UserDataExport

logger = logging.getLogger(__name__)


def _ttl_hours() -> int:
    import os

    try:
        return int(os.getenv("RODO_EXPORT_TTL_HOURS", "24"))
    except ValueError:
        return 24


def _export_response(job: UserDataExport, *, replayed: bool) -> Response:
    ready = job.status == UserDataExport.STATUS_READY
    return Response(
        {
            "status": "ready" if ready else "queued",
            "job_id": job.job_id,
            "message": "RODO export already available."
            if ready
            else "RODO export queued — poll GET /me/export/ or download when ready.",
            "expires_at": job.expires_at.isoformat(),
            "ttl_hours": _ttl_hours(),
            "replayed": replayed,
            "download_url": f"/api/users/me/export/{job.job_id}/download/" if ready else None,
        },
        status=status.HTTP_200_OK if ready else status.HTTP_202_ACCEPTED,
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def user_data_export_view(request):
    """Queue (POST) or list recent export jobs (GET)."""
    if request.method == "GET":
        rows = UserDataExport.objects.filter(user=request.user).order_by("-created_at")[:10]
        return Response(
            [
                {
                    "job_id": r.job_id,
                    "status": r.status,
                    "activity_count": r.activity_count,
                    "expires_at": r.expires_at.isoformat(),
                    "expired": r.is_expired,
                    "download_url": f"/api/users/me/export/{r.job_id}/download/"
                    if r.status == UserDataExport.STATUS_READY and not r.is_expired
                    else None,
                }
                for r in rows
            ]
        )

    from users.export_tasks import export_user_data_task

    now = timezone.now()
    with transaction.atomic():
        # Serialize export creation per user so concurrent retries cannot queue
        # two expensive archives after the first response is lost.
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
        existing = (
            UserDataExport.objects.filter(
                user=request.user,
                expires_at__gt=now,
                status__in=(
                    UserDataExport.STATUS_PENDING,
                    UserDataExport.STATUS_READY,
                ),
            )
            .order_by("-created_at")
            .first()
        )
        if existing:
            return _export_response(existing, replayed=True)

        job_id = uuid.uuid4().hex[:12]
        expires = now + timezone.timedelta(hours=_ttl_hours())
        job = UserDataExport.objects.create(
            user=request.user,
            job_id=job_id,
            status=UserDataExport.STATUS_PENDING,
            expires_at=expires,
        )
        transaction.on_commit(
            lambda user_id=request.user.id, export_job_id=job_id: export_user_data_task.delay(
                user_id, export_job_id
            )
        )

    return _export_response(job, replayed=False)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_data_export_download_view(request, job_id: str):
    """Download completed export ZIP (owner only, before expiry)."""
    from activities.gpx_storage import read_gpx

    try:
        job = UserDataExport.objects.get(job_id=job_id, user=request.user)
    except UserDataExport.DoesNotExist:
        return Response({"detail": "Export job not found."}, status=status.HTTP_404_NOT_FOUND)

    if job.is_expired:
        return Response({"detail": "Export link expired."}, status=status.HTTP_410_GONE)
    if job.status != UserDataExport.STATUS_READY or not job.storage_uri:
        return Response({"detail": "Export not ready."}, status=status.HTTP_409_CONFLICT)

    try:
        body = read_gpx(job.storage_uri)
    except Exception:
        logger.exception("user_data_export.download_failed")
        return Response(
            {"detail": "Download failed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    response = HttpResponse(body, content_type="application/zip")
    response["Content-Disposition"] = f'attachment; filename="4velo-export-{job_id}.zip"'
    return response
