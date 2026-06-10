"""RODO bulk export task (P2 GPX F5)."""

from __future__ import annotations

import json
import logging
import zipfile
from io import BytesIO

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(queue="default", name="users.export_user_data_task")
def export_user_data_task(user_id: int, job_id: str) -> dict:
    from django.contrib.auth import get_user_model
    from django.utils import timezone

    from activities.gpx_export import linestring_to_gpx
    from activities.gpx_forensics import is_simulated_activity
    from activities.gpx_storage import presigned_download_url, store_export
    from users.export_models import UserDataExport

    User = get_user_model()
    try:
        job = UserDataExport.objects.get(job_id=job_id, user_id=user_id)
    except UserDataExport.DoesNotExist:
        return {"status": "missing_job", "job_id": job_id}

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        job.status = UserDataExport.STATUS_FAILED
        job.error = "user_missing"
        job.save(update_fields=["status", "error"])
        return {"status": "missing", "user_id": user_id}

    profile = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": getattr(user, "role", None),
        "tenant_id": str(user.tenant_id) if getattr(user, "tenant_id", None) else None,
        "exported_at": timezone.now().isoformat(),
    }

    buf = BytesIO()
    activity_count = 0
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("profile.json", json.dumps(profile, indent=2))
        for activity in user.activities.filter(route_path__isnull=False).order_by("-start_time")[:200]:
            try:
                gpx = linestring_to_gpx(
                    activity.route_path,
                    track_name=f"Activity {activity.id}",
                    activity_type=activity.type.lower(),
                    simulated=is_simulated_activity(activity),
                )
                zf.writestr(f"activities/{activity.id}.gpx", gpx)
                activity_count += 1
            except Exception as exc:
                logger.warning("export.skip_gpx activity=%s err=%s", activity.id, exc)

    key = f"exports/{user_id}/{job_id}.zip"
    uri = store_export(key, buf.getvalue())
    presigned = presigned_download_url(uri)

    job.status = UserDataExport.STATUS_READY
    job.storage_uri = uri
    job.download_key = key
    job.activity_count = activity_count
    job.error = ""
    job.save(update_fields=["status", "storage_uri", "download_key", "activity_count", "error"])

    return {
        "status": "ok",
        "job_id": job_id,
        "user_id": user_id,
        "activity_count": activity_count,
        "storage_uri": uri,
        "presigned_url": presigned,
        "ttl_hours": 24,
    }
