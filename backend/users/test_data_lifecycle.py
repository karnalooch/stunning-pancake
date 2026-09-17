from __future__ import annotations

import zipfile
from datetime import timedelta
from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.utils import timezone

from activities.gpx_storage import read_gpx, store_export
from activities.models import Activity
from users.data_lifecycle import RAW_GPS_RETENTION_DAYS, purge_expired_raw_gps
from users.export_models import UserDataExport
from users.export_tasks import export_user_data_task
from users.models import Tenant

pytestmark = pytest.mark.django_db


def _user(username: str = "privacy-user"):
    tenant = Tenant.objects.create(id=f"tenant-{username}", name=username, is_active=True)
    return get_user_model().objects.create_user(
        username=username,
        email=f"{username}@example.invalid",
        password="x",
        tenant=tenant,
    )


def test_user_delete_removes_materialized_export(monkeypatch, tmp_path):
    monkeypatch.setenv("GPX_LOCAL_ROOT", str(tmp_path))
    user = _user("delete-export")
    uri = store_export(f"exports/{user.id}/delete-me.zip", b"private export")
    UserDataExport.objects.create(
        user=user,
        job_id="deleteexp01",
        status=UserDataExport.STATUS_READY,
        storage_uri=uri,
        expires_at=timezone.now() + timedelta(hours=1),
    )

    path = tmp_path / f"exports/{user.id}/delete-me.zip"
    assert path.exists()

    user.delete()

    assert not path.exists()
    assert not get_user_model().objects.filter(username="delete-export").exists()


def test_user_delete_fails_closed_when_export_storage_delete_fails(monkeypatch):
    user = _user("delete-failure")
    UserDataExport.objects.create(
        user=user,
        job_id="deletefail01",
        status=UserDataExport.STATUS_READY,
        storage_uri="s3://private-bucket/export.zip",
        expires_at=timezone.now() + timedelta(hours=1),
    )

    def fail_delete(_uri: str) -> None:
        raise RuntimeError("storage unavailable")

    monkeypatch.setattr("users.data_lifecycle.delete_storage_uri_strict", fail_delete)

    with pytest.raises(RuntimeError, match="storage unavailable"):
        user.delete()

    assert get_user_model().objects.filter(pk=user.pk).exists()


def test_export_contains_all_activity_metadata_and_retained_raw_gps(monkeypatch, tmp_path):
    monkeypatch.setenv("GPX_LOCAL_ROOT", str(tmp_path))
    user = _user("export-complete")
    activity = Activity.objects.create(
        user=user,
        tenant=user.tenant,
        type="RUN",
        start_time=timezone.now(),
        distance=123.0,
        route_path=None,
    )
    job = UserDataExport.objects.create(
        user=user,
        job_id="complete01",
        status=UserDataExport.STATUS_PENDING,
        expires_at=timezone.now() + timedelta(hours=24),
    )
    raw_rows = [
        {
            "time": timezone.now().isoformat(),
            "device_id": "device-1",
            "activity_id": activity.id,
            "seq": 1,
            "lat": 52.1,
            "lon": 22.2,
            "speed_ms": 7.0,
            "accuracy_m": 3.0,
        }
    ]
    monkeypatch.setattr("users.data_lifecycle.retained_gps_rows_for_user", lambda _uid: raw_rows)

    result = export_user_data_task(user.id, job.job_id)
    job.refresh_from_db()
    archive = read_gpx(job.storage_uri)

    with zipfile.ZipFile(BytesIO(archive), "r") as zf:
        names = set(zf.namelist())
        raw_body = zf.read("raw_gps.json").decode("utf-8")
        activity_body = zf.read(f"activities/{activity.id}.json").decode("utf-8")

    assert result["raw_gps_points"] == 1
    assert "manifest.json" in names
    assert "raw_gps.json" in names
    assert f"activities/{activity.id}.json" in names
    assert "device-1" in raw_body
    assert '"has_canonical_route": false' in activity_body


@pytest.mark.skipif(connection.vendor != "postgresql", reason="raw telemetry tables are PostgreSQL")
@pytest.mark.django_db(transaction=True)
def test_raw_gps_retention_deletes_only_rows_older_than_30_days():
    now = timezone.now()
    old = now - timedelta(days=RAW_GPS_RETENTION_DAYS, seconds=1)
    fresh = now - timedelta(days=RAW_GPS_RETENTION_DAYS) + timedelta(seconds=1)

    try:
        with connection.cursor() as cursor:
            cursor.execute("DROP TABLE IF EXISTS telemetry_ingest_receipts")
            cursor.execute("DROP TABLE IF EXISTS gps_points")
            cursor.execute(
                """
                CREATE TABLE gps_points (
                    time TIMESTAMPTZ NOT NULL,
                    device_id TEXT NOT NULL,
                    user_id INTEGER,
                    lat DOUBLE PRECISION NOT NULL,
                    lon DOUBLE PRECISION NOT NULL,
                    activity_id INTEGER,
                    seq BIGINT
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE telemetry_ingest_receipts (
                    client_batch_id TEXT PRIMARY KEY,
                    activity_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    point_count INTEGER NOT NULL,
                    persisted_count INTEGER NOT NULL,
                    dropped_privacy INTEGER NOT NULL,
                    max_seq BIGINT NOT NULL,
                    payload_fingerprint TEXT,
                    acked_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            cursor.executemany(
                """
                INSERT INTO gps_points (time, device_id, user_id, lat, lon, activity_id, seq)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    (old, "old", 1, 52.0, 22.0, 10, 1),
                    (fresh, "fresh", 1, 52.1, 22.1, 11, 1),
                ],
            )
            cursor.executemany(
                """
                INSERT INTO telemetry_ingest_receipts (
                    client_batch_id, activity_id, user_id, point_count, persisted_count,
                    dropped_privacy, max_seq, payload_fingerprint, acked_at
                ) VALUES (%s, %s, %s, 1, 1, 0, 1, %s, %s)
                """,
                [
                    ("old-batch", 10, 1, "old-fingerprint", old),
                    ("fresh-batch", 11, 1, "fresh-fingerprint", fresh),
                ],
            )

        deleted = purge_expired_raw_gps(now=now)

        with connection.cursor() as cursor:
            cursor.execute("SELECT device_id FROM gps_points ORDER BY device_id")
            gps_devices = [row[0] for row in cursor.fetchall()]
            cursor.execute("SELECT client_batch_id FROM telemetry_ingest_receipts ORDER BY 1")
            receipt_ids = [row[0] for row in cursor.fetchall()]

        assert deleted == {"gps_points": 1, "telemetry_ingest_receipts": 1}
        assert gps_devices == ["fresh"]
        assert receipt_ids == ["fresh-batch"]
    finally:
        with connection.cursor() as cursor:
            cursor.execute("DROP TABLE IF EXISTS telemetry_ingest_receipts")
            cursor.execute("DROP TABLE IF EXISTS gps_points")
