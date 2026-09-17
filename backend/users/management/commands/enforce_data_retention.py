"""Enforce T72 privacy retention for raw GPS and materialized exports."""

from django.core.management.base import BaseCommand
from django.utils import timezone

from activities.gpx_storage import delete_storage_uri
from users.data_lifecycle import RAW_GPS_RETENTION_DAYS, purge_expired_raw_gps
from users.export_models import UserDataExport


class Command(BaseCommand):
    help = "Purge raw GPS older than 30 days and expired RODO export artifacts."

    def handle(self, *args, **options):
        del args, options
        now = timezone.now()
        expired_exports = list(
            UserDataExport.objects.filter(expires_at__lte=now).only("id", "storage_uri")
        )
        removed_objects = 0
        for export in expired_exports:
            if export.storage_uri and delete_storage_uri(export.storage_uri):
                removed_objects += 1

        expired_ids = [export.id for export in expired_exports]
        deleted_export_rows = 0
        if expired_ids:
            deleted_export_rows, _ = UserDataExport.objects.filter(id__in=expired_ids).delete()

        telemetry = purge_expired_raw_gps(now=now)
        self.stdout.write(
            self.style.SUCCESS(
                "retention enforced: "
                f"raw_gps_days={RAW_GPS_RETENTION_DAYS} "
                f"gps_points={telemetry['gps_points']} "
                f"receipts={telemetry['telemetry_ingest_receipts']} "
                f"export_objects={removed_objects} "
                f"export_rows={deleted_export_rows}"
            )
        )
