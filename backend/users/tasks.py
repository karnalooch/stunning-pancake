"""
Celery task registration for the `users` app.
Celery autodiscovery imports `<app>.tasks` modules; we re-export our bulk task.
"""

from celery import shared_task
from django.utils import timezone

from activities.gpx_storage import delete_storage_uri

from .bulk_tasks import bulk_action_task  # noqa: F401
from .data_lifecycle import purge_expired_raw_gps
from .export_models import UserDataExport
from .push_tasks import (  # noqa: F401
    send_city_ranking_push,
    send_quest_push,
    send_season_end_push,
)


@shared_task(queue="default", name="users.tasks.enforce_data_retention", ignore_result=True)
def enforce_data_retention() -> dict[str, int]:
    """Purge expired exports and raw GPS while preserving retryable failures."""

    now = timezone.now()
    exports = list(UserDataExport.objects.filter(expires_at__lte=now).only("id", "storage_uri"))
    deletable_ids: list[int] = []
    removed_objects = 0
    for export in exports:
        if not export.storage_uri:
            deletable_ids.append(export.id)
            continue
        if delete_storage_uri(export.storage_uri):
            deletable_ids.append(export.id)
            removed_objects += 1

    deleted_export_rows = 0
    if deletable_ids:
        deleted_export_rows, _ = UserDataExport.objects.filter(id__in=deletable_ids).delete()

    telemetry = purge_expired_raw_gps(now=now)
    return {
        "gps_points": telemetry["gps_points"],
        "telemetry_ingest_receipts": telemetry["telemetry_ingest_receipts"],
        "export_objects": removed_objects,
        "export_rows": deleted_export_rows,
    }
