"""RODO bulk export task (P2 GPX F5)."""

from __future__ import annotations

import json
import logging
import uuid
import zipfile
from io import BytesIO

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(queue="default", name="users.export_user_data_task")
def export_user_data_task(user_id: int) -> dict:
    from django.contrib.auth import get_user_model

    from activities.gpx_export import linestring_to_gpx
    from activities.gpx_storage import store_export

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return {"status": "missing", "user_id": user_id}

    profile = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": getattr(user, "role", None),
        "tenant_id": str(user.tenant_id) if getattr(user, "tenant_id", None) else None,
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
                )
                zf.writestr(f"activities/{activity.id}.gpx", gpx)
                activity_count += 1
            except Exception as exc:
                logger.warning("export.skip_gpx activity=%s err=%s", activity.id, exc)

    job_id = uuid.uuid4().hex[:12]
    key = f"exports/{user_id}/{job_id}.zip"
    uri = store_export(key, buf.getvalue())

    return {
        "status": "ok",
        "user_id": user_id,
        "activity_count": activity_count,
        "storage_uri": uri,
        "download_key": key,
        "ttl_hours": 24,
    }
