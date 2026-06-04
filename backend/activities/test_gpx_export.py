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
