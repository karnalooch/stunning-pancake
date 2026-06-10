"""GPX forensics (P2 F3)."""

import pytest
from django.contrib.gis.geos import LineString

from activities.gpx_forensics import gpx_track_distance_m, route_fingerprint, scan_activity_forensics
from activities.models import Activity
from users.models import Tenant

pytestmark = pytest.mark.django_db


@pytest.fixture
def tenant(db):
    return Tenant.objects.create(id="city-fp", name="City FP", is_active=True)


def test_route_fingerprint_stable():
    route = LineString([(21.0, 52.0), (21.01, 52.01)], srid=4326)
    assert route_fingerprint(route) == route_fingerprint(route)
    assert len(route_fingerprint(route)) == 64


def test_metadata_mismatch_flag(tenant):
    from django.contrib.auth import get_user_model
    from django.utils import timezone

    User = get_user_model()
    u1 = User.objects.create_user(username="a1", email="a1@t.com", password="x", tenant=tenant)
    route = LineString([(21.0, 52.0), (21.1, 52.1)], srid=4326)
    act = Activity.objects.create(
        user=u1,
        tenant=tenant,
        type="RUN",
        start_time=timezone.now(),
        distance=100.0,
        route_path=route,
    )
    flags = scan_activity_forensics(act)
    assert any("metadata_distance_mismatch" in f for f in flags)


def test_gpx_track_distance_positive():
    route = LineString([(21.0, 52.0), (21.01, 52.01)], srid=4326)
    assert gpx_track_distance_m(route) > 1000
