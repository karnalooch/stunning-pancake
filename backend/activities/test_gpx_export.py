"""GPX F1 — export from route_path."""

import pytest
from django.contrib.gis.geos import LineString

from activities.gpx_export import linestring_to_gpx


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
