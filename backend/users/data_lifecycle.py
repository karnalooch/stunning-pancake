"""T72 privacy lifecycle for retained GPS, exports and account deletion."""

from __future__ import annotations

import logging
from datetime import timedelta

from django.db import connection
from django.utils import timezone

from activities.gpx_storage import delete_storage_uri

logger = logging.getLogger(__name__)

RAW_GPS_RETENTION_DAYS = 30


def _table_exists(table_name: str) -> bool:
    """Return whether a telemetry-owned table exists in the shared database."""

    if connection.vendor != "postgresql":
        return False
    with connection.cursor() as cursor:
        cursor.execute("SELECT to_regclass(%s)", [f"public.{table_name}"])
        return cursor.fetchone()[0] is not None


def delete_user_telemetry(user_id: int) -> dict[str, int]:
    """Delete raw GPS and durable receipt metadata for one user.

    The telemetry tables are not Django models, so account deletion must remove
    them explicitly before the Django user cascade runs.
    """

    deleted = {"gps_points": 0, "telemetry_ingest_receipts": 0}
    with connection.cursor() as cursor:
        if _table_exists("gps_points"):
            cursor.execute("DELETE FROM gps_points WHERE user_id = %s", [user_id])
            deleted["gps_points"] = cursor.rowcount
        if _table_exists("telemetry_ingest_receipts"):
            cursor.execute(
                "DELETE FROM telemetry_ingest_receipts WHERE user_id = %s",
                [user_id],
            )
            deleted["telemetry_ingest_receipts"] = cursor.rowcount
    return deleted


def delete_user_export_artifacts(user) -> int:
    """Best-effort remove materialized export objects before DB cascade.

    Missing/expired files are already absent and are therefore safe. Storage
    driver errors are logged by ``delete_storage_uri``; the DB row then disappears
    with the user cascade so stale application download links cannot survive.
    """

    removed = 0
    for export in user.data_exports.exclude(storage_uri="").only("storage_uri"):
        if delete_storage_uri(export.storage_uri):
            removed += 1
    return removed


def delete_user_personal_data(user) -> dict[str, int]:
    """Purge non-Django personal-data stores before deleting the account row."""

    export_count = delete_user_export_artifacts(user)
    telemetry = delete_user_telemetry(int(user.id))
    return {"exports": export_count, **telemetry}


def retained_gps_rows_for_user(user_id: int) -> list[dict[str, object]]:
    """Return privacy-filtered raw GPS still inside the explicit 30-day window."""

    if not _table_exists("gps_points"):
        return []

    cutoff = timezone.now() - timedelta(days=RAW_GPS_RETENTION_DAYS)
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT time, device_id, activity_id, seq, lat, lon, speed_ms, accuracy_m
            FROM gps_points
            WHERE user_id = %s AND time >= %s
            ORDER BY time ASC, activity_id ASC NULLS LAST, seq ASC NULLS LAST
            """,
            [user_id, cutoff],
        )
        rows = cursor.fetchall()

    return [
        {
            "time": row[0].isoformat(),
            "device_id": row[1],
            "activity_id": row[2],
            "seq": row[3],
            "lat": row[4],
            "lon": row[5],
            "speed_ms": row[6],
            "accuracy_m": row[7],
        }
        for row in rows
    ]


def purge_expired_raw_gps(*, now=None) -> dict[str, int]:
    """Enforce the 30-day raw-GPS/receipt retention boundary.

    ``Activity.route_path`` is intentionally retained as the derived canonical
    ride record. Audit-log and backup retention are governed by their own
    contracts and are not silently shortened here.
    """

    if connection.vendor != "postgresql":
        return {"gps_points": 0, "telemetry_ingest_receipts": 0}

    cutoff = (now or timezone.now()) - timedelta(days=RAW_GPS_RETENTION_DAYS)
    deleted = {"gps_points": 0, "telemetry_ingest_receipts": 0}
    with connection.cursor() as cursor:
        if _table_exists("gps_points"):
            cursor.execute("DELETE FROM gps_points WHERE time < %s", [cutoff])
            deleted["gps_points"] = cursor.rowcount
        if _table_exists("telemetry_ingest_receipts"):
            cursor.execute(
                "DELETE FROM telemetry_ingest_receipts WHERE acked_at < %s",
                [cutoff],
            )
            deleted["telemetry_ingest_receipts"] = cursor.rowcount

    logger.info(
        "privacy.retention_purge gps_points=%d receipts=%d cutoff=%s",
        deleted["gps_points"],
        deleted["telemetry_ingest_receipts"],
        cutoff.isoformat(),
    )
    return deleted
