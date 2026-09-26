from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString
from django.utils import timezone
from rest_framework.test import APIClient

from activities.models import Activity
from activities.serializers import ActivitySerializer
from users.models import Tenant

User = get_user_model()


@pytest.mark.django_db
def test_mobile_activity_detail_exposes_only_public_fields_with_route_data():
    tenant = Tenant.objects.create(name="T82 Detail City")
    user = User.objects.create_user(username="t82-detail", password="x", tenant=tenant)
    start = timezone.now() - timedelta(hours=1)
    route = LineString(
        [(22.2400, 52.1600), (22.2500, 52.1700), (22.2600, 52.1800)],
        srid=4326,
    )
    activity = Activity.objects.create(
        user=user,
        tenant=tenant,
        type="BIKE",
        start_time=start,
        end_time=start + timedelta(hours=1),
        duration=timedelta(hours=1),
        distance=30_000,
        route_path=route,
        verification_score=0.9,
        rejection_reason="GPS_SPOOF",
        rejection_notes="internal moderator note",
        client_request_id="internal-request-id",
        external_source="STRAVA",
        external_id="external-activity-id",
        gpx_storage_key="private/gpx/object-key",
        gpx_sha256="a" * 64,
        route_fingerprint="b" * 64,
        gpx_forensics_flags=["clock-drift"],
    )

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get(f"/api/activities/sessions/{activity.id}/detail/")

    assert response.status_code == 200
    assert response.data["duration"] == 3600.0
    assert response.data["rejection_reason"] == "GPS_SPOOF"
    assert [list(pair) for pair in response.data["route_coords"]] == [
        [22.24, 52.16],
        [22.25, 52.17],
        [22.26, 52.18],
    ]

    internal_fields = {
        "user",
        "tenant",
        "route_path",
        "client_request_id",
        "moderated_at",
        "moderated_by",
        "moderation_assignee",
        "rejection_notes",
        "external_source",
        "external_id",
        "gpx_storage_key",
        "gpx_sha256",
        "gpx_generated_at",
        "route_fingerprint",
        "gpx_forensics_flags",
        "user_info",
    }
    assert internal_fields.isdisjoint(response.data.keys())


@pytest.mark.django_db
def test_elevated_activity_detail_keeps_operational_fields_for_admin():
    tenant = Tenant.objects.create(name="T82 Admin City")
    rider = User.objects.create_user(username="t82-rider", password="x", tenant=tenant)
    admin = User.objects.create_user(
        username="t82-admin",
        password="x",
        tenant=tenant,
        role="TENANT_ADMIN",
    )
    activity = Activity.objects.create(
        user=rider,
        tenant=tenant,
        type="RUN",
        start_time=timezone.now(),
        rejection_reason="OTHER",
        rejection_notes="admin-visible note",
        gpx_sha256="c" * 64,
        gpx_forensics_flags=["suspicious-speed"],
    )

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get(f"/api/activities/sessions/{activity.id}/detail/")

    assert response.status_code == 200
    assert response.data["rejection_notes"] == "admin-visible note"
    assert response.data["gpx_sha256"] == "c" * 64
    assert response.data["gpx_forensics_flags"] == ["suspicious-speed"]
    assert response.data["user_info"]["username"] == rider.username


@pytest.mark.django_db
def test_activity_history_exposes_moderation_state_read_only():
    tenant = Tenant.objects.create(name="T82 History City")
    user = User.objects.create_user(username="t82-history", password="x", tenant=tenant)
    activity = Activity.objects.create(
        user=user,
        tenant=tenant,
        type="RUN",
        start_time=timezone.now(),
        rejection_reason="GPS_SPOOF",
        rejection_notes="reviewed",
    )

    payload = ActivitySerializer(activity).data

    assert payload["rejection_reason"] == "GPS_SPOOF"
    assert "rejection_notes" not in payload

    serializer = ActivitySerializer(
        activity,
        data={"rejection_reason": "OTHER"},
        partial=True,
    )
    assert serializer.is_valid(), serializer.errors
    updated = serializer.save()
    assert updated.rejection_reason == "GPS_SPOOF"
