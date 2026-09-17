"""GPX F1 plus T74 activity-create idempotency blocking coverage."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString
from rest_framework import serializers

from activities.gpx_export import linestring_to_gpx
from activities.models import Activity
from activities.serializers import ActivitySerializer
from users.models import Tenant

User = get_user_model()


@pytest.mark.django_db
def test_linestring_to_gpx_emits_trkpt():
    route = LineString([(21.0, 52.0), (21.01, 52.01), (21.02, 52.02)], srid=4326)
    gpx = linestring_to_gpx(route, track_name="Test ride", activity_type="cycling")

    assert "<gpx" in gpx
    assert 'lat="52.000000"' in gpx
    assert 'lon="21.000000"' in gpx
    assert "<trkpt" in gpx
    assert gpx.count("<trkpt") == 3


def test_linestring_to_gpx_requires_two_points():
    with pytest.raises(ValueError, match="at least two"):
        linestring_to_gpx(LineString([(1.0, 2.0)], srid=4326))


def test_linestring_to_gpx_simulated_tag():
    route = LineString([(21.0, 52.0), (21.01, 52.01)], srid=4326)
    gpx = linestring_to_gpx(route, simulated=True)
    assert "<simulated>true</simulated>" in gpx


GOLDEN_COORDS = [
    (21.0122, 52.2297),
    (21.0130, 52.2305),
    (21.0140, 52.2310),
    (21.0155, 52.2318),
]


def test_golden_gpx_fingerprint_stable():
    from activities.gpx_forensics import route_fingerprint

    route = LineString(GOLDEN_COORDS, srid=4326)
    gpx_a = linestring_to_gpx(route, track_name="Golden", activity_type="running")
    gpx_b = linestring_to_gpx(route, track_name="Golden", activity_type="running")
    assert route_fingerprint(route) == route_fingerprint(route)
    assert gpx_a.count("<trkpt") == len(GOLDEN_COORDS)
    assert gpx_a.count("<trkpt") == gpx_b.count("<trkpt")


@pytest.mark.django_db
def test_t74_activity_create_retry_replays_original_row():
    tenant = Tenant.objects.create(name="T74 Session City")
    user = User.objects.create_user(username="t74-session", password="x", tenant=tenant)
    payload = {"type": "BIKE", "start_time": "2026-09-17T20:00:00Z"}

    first = ActivitySerializer(data=payload)
    assert first.is_valid(), first.errors
    activity_a = first.save(user=user)

    retry = ActivitySerializer(data=payload)
    assert retry.is_valid(), retry.errors
    activity_b = retry.save(user=user)

    assert activity_b.pk == activity_a.pk
    assert Activity.objects.filter(user=user).count() == 1


@pytest.mark.django_db
def test_t74_activity_request_id_rejects_payload_conflict():
    tenant = Tenant.objects.create(name="T74 Conflict City")
    user = User.objects.create_user(username="t74-conflict", password="x", tenant=tenant)
    first = ActivitySerializer(
        data={
            "type": "BIKE",
            "start_time": "2026-09-17T20:00:00Z",
            "client_request_id": "ride-intent-123",
        }
    )
    assert first.is_valid(), first.errors
    first.save(user=user)

    conflicting = ActivitySerializer(
        data={
            "type": "RUN",
            "start_time": "2026-09-17T20:05:00Z",
            "client_request_id": "ride-intent-123",
        }
    )
    assert conflicting.is_valid(), conflicting.errors

    with pytest.raises(serializers.ValidationError):
        conflicting.save(user=user)
    assert Activity.objects.filter(user=user).count() == 1
