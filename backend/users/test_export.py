"""RODO export jobs (P2 F5)."""

import pytest
from django.contrib.gis.geos import LineString
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

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
    route = LineString([(21.0, 52.0), (21.01, 52.01)], srid=4326)
    Activity.objects.create(
        user=user,
        tenant=tenant,
        type="RUN",
        start_time=timezone.now(),
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
