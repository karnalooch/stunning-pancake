"""Unit tests for live-sim routing and multi-city assignment."""
from types import SimpleNamespace

from django.test import SimpleTestCase

from activities.simulator_tasks import _interpolate_along_polyline
from simulate_active_cities import CITIES, CITIES_BY_NAME, resolve_city_for_user


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
        waypoints = [(0.0, 0.0), (0.0, 0.01), (0.01, 0.01)]
        lat, lon, course = _interpolate_along_polyline(waypoints, 0.5)
        self.assertAlmostEqual(lat, 0.0, places=4)
        self.assertAlmostEqual(lon, 0.01, places=4)
        self.assertGreaterEqual(course, 0)
        self.assertLess(course, 360)


class ResolveCityForUserTest(SimpleTestCase):
    def test_tenant_name_maps_to_city(self):
        warsaw = CITIES_BY_NAME['Warszawa']
        user = SimpleNamespace(
            id=1,
            username='warszawa_athlete_000001',
            tenant=SimpleNamespace(name='Warszawa'),
        )
        self.assertEqual(resolve_city_for_user(user)['slug'], warsaw['slug'])

    def test_username_prefix_when_no_tenant(self):
        user = SimpleNamespace(id=2, username='krakow_athlete_000042', tenant=None)
        self.assertEqual(resolve_city_for_user(user)['slug'], 'krakow')

    def test_stable_hash_fallback(self):
        user = SimpleNamespace(id=99, username='legacy_athlete', tenant=None)
        city = resolve_city_for_user(user)
        self.assertIn(city, CITIES)
        self.assertEqual(resolve_city_for_user(user)['slug'], city['slug'])


class PerCityRideCapTest(SimpleTestCase):
    def test_even_split_across_ten_cities(self):
        target = 2500
        n = len(CITIES)
        base = target // n
        extra = target % n
        caps = [base + (1 if i < extra else 0) for i in range(n)]
        self.assertEqual(sum(caps), target)
        self.assertGreaterEqual(min(caps), base)
