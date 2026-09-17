"""RODO export jobs and T72 privacy lifecycle blocking coverage."""

from pathlib import Path

import pytest
from django.contrib.gis.geos import LineString
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from activities.gpx_storage import store_export
from activities.models import Activity
from users.export_models import UserDataExport
from users.export_tasks import export_user_data_task
from users.models import Tenant

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def tenant(db):
    return Tenant.objects.create(id="city-exp", name="City Exp", is_active=True)


def test_export_task_builds_zip_and_marks_ready(tenant):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.create_user(
        username="ath",
        email="ath@t.com",
        password="x",
        tenant=tenant,
    )
    route = LineString((21.0, 52.0), (21.01, 52.01), srid=4326)
    Activity.objects.create(
        user=user,
        tenant=tenant,
        type="RUN",
        start_time=timezone.now(),
        end_time=timezone.now(),
        distance=1200.0,
        route_path=route,
    )
    job = UserDataExport.objects.create(
        user=user,
        job_id="jobtest01",
        status=UserDataExport.STATUS_PENDING,
        expires_at=timezone.now() + timezone.timedelta(hours=24),
    )
    result = export_user_data_task(user.id, job.job_id)
    job.refresh_from_db()

    assert result["status"] == "ok"
    assert job.status == UserDataExport.STATUS_READY
    assert job.activity_count == 1
    assert job.storage_uri.startswith("local:")


def test_export_download_requires_owner(api_client, tenant):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.create_user(
        username="u1",
        email="u1@t.com",
        password="x",
        tenant=tenant,
    )
    other = User.objects.create_user(
        username="u2",
        email="u2@t.com",
        password="x",
        tenant=tenant,
    )
    job = UserDataExport.objects.create(
        user=user,
        job_id="dljob01",
        status=UserDataExport.STATUS_READY,
        storage_uri="local:exports/1/dljob01.zip",
        expires_at=timezone.now() + timezone.timedelta(hours=1),
    )
    api_client.force_authenticate(user=other)
    url = reverse("user-data-export-download", kwargs={"job_id": job.job_id})
    res = api_client.get(url)
    assert res.status_code == 404


def test_t72_retention_task_is_scheduled_daily():
    from core.celery import app

    schedule = app.conf.beat_schedule["privacy-data-retention-daily"]
    assert schedule["task"] == "users.tasks.enforce_data_retention"
    assert schedule["schedule"] == 86400.0
    assert schedule["options"] == {"queue": "default"}


def test_t72_user_delete_removes_external_artifacts(monkeypatch, tmp_path, tenant):
    from django.contrib.auth import get_user_model

    monkeypatch.setenv("GPX_LOCAL_ROOT", str(tmp_path))
    user = get_user_model().objects.create_user(
        username="delete-export-gate",
        email="delete-export-gate@example.invalid",
        password="x",
        tenant=tenant,
    )
    export_uri = store_export(f"exports/{user.id}/delete-me.zip", b"private export")
    UserDataExport.objects.create(
        user=user,
        job_id="deletegate01",
        status=UserDataExport.STATUS_READY,
        storage_uri=export_uri,
        expires_at=timezone.now() + timezone.timedelta(hours=1),
    )
    activity_uri = store_export(f"activities/{user.id}/ride.gpx", b"private gpx")
    Activity.objects.create(
        user=user,
        tenant=tenant,
        type="BIKE",
        start_time=timezone.now(),
        distance=1000.0,
        gpx_storage_key=activity_uri,
    )

    export_path = Path(tmp_path) / "exports" / str(user.id) / "delete-me.zip"
    activity_path = Path(tmp_path) / "activities" / str(user.id) / "ride.gpx"
    assert export_path.exists()
    assert activity_path.exists()

    user.delete()

    assert not export_path.exists()
    assert not activity_path.exists()
    assert not get_user_model().objects.filter(username="delete-export-gate").exists()
