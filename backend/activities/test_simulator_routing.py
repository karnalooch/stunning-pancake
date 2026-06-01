"""Unit tests for live-sim route interpolation (no BRouter required)."""
from django.test import SimpleTestCase

from activities.simulator_tasks import _interpolate_along_polyline


class InterpolateAlongPolylineTest(SimpleTestCase):
    def test_start_and_end_of_route(self):
        waypoints = [(52.0, 21.0), (52.001, 21.0), (52.001, 21.001)]
        lat0, lon0, _ = _interpolate_along_polyline(waypoints, 0.0)
        lat1, lon1, _ = _interpolate_along_polyline(waypoints, 1.0)
        self.assertAlmostEqual(lat0, 52.0, places=5)
        self.assertAlmostEqual(lon0, 21.0, places=5)
        self.assertAlmostEqual(lat1, 52.001, places=5)
        self.assertAlmostEqual(lon1, 21.001, places=5)

    def test_midpoint_on_longer_segment(self):
        # Two equal-length legs — 50% progress should be at the bend
        waypoints = [(0.0, 0.0), (0.0, 0.01), (0.01, 0.01)]
        lat, lon, course = _interpolate_along_polyline(waypoints, 0.5)
        self.assertAlmostEqual(lat, 0.0, places=4)
        self.assertAlmostEqual(lon, 0.01, places=4)
        self.assertGreaterEqual(course, 0)
        self.assertLess(course, 360)
