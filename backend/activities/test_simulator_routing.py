"""Unit tests for live-sim routing and multi-city assignment."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.test import SimpleTestCase

pytestmark = pytest.mark.simulator_light

from activities.services import BRouterService
from activities import simulator_state as sim
from activities.simulator_tasks import (
    _brouter_profiles_for_activity,
    _interpolate_along_polyline,
    _skip_brouter_now,
)
from simulate_active_cities import CITIES, CITIES_BY_NAME, resolve_city_for_user


class BRouterServiceParseTest(SimpleTestCase):
    def test_extract_line_coordinates_from_geojson(self):
        data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[21.0, 52.0], [21.01, 52.01]],
                    },
                },
            ],
        }
        pts = BRouterService.extract_line_coordinates(data)
        self.assertEqual(pts, [(52.0, 21.0), (52.01, 21.01)])

    def test_classify_target_island_as_unroutable_warning(self):
        cls = BRouterService.classify_error("target island reached, pass=0", 400)
        self.assertEqual(cls["severity"], "warning")
        self.assertTrue(cls["retryable"])
        self.assertEqual(cls["code"], BRouterService.UNROUTABLE_ERROR_CODE)

    def test_classify_transport_failure_as_error(self):
        cls = BRouterService.classify_error("gateway timeout", 504)
        self.assertEqual(cls["severity"], "error")
        self.assertTrue(cls["retryable"])
        self.assertEqual(cls["code"], BRouterService.TRANSPORT_ERROR_CODE)

    def test_classify_remote_disconnected_as_transport(self):
        cls = BRouterService.classify_error(
            "RemoteDisconnected('Remote end closed connection without response')",
            0,
        )
        self.assertTrue(cls["retryable"])
        self.assertEqual(cls["code"], BRouterService.TRANSPORT_ERROR_CODE)


class BrouterProfilesFallbackTest(SimpleTestCase):
    def test_bike_includes_trekking_fallback(self):
        profiles = _brouter_profiles_for_activity("BIKE")
        self.assertEqual(profiles[0], "bicycle")
        self.assertIn("trekking", profiles)


class GenerateRouteWaypointsCacheTest(SimpleTestCase):
    @patch.dict("os.environ", {"SCALE_SIM_STRICT_ROAD_ROUTES": "1"}, clear=False)
    @patch("activities.simulator_tasks._skip_brouter_now", return_value=False)
    @patch("activities.simulator_tasks.cache")
    @patch("activities.sim_routing.road_route_waypoints", return_value=None)
    @patch("activities.scale_config.resolve_live_scale_limits")
    @patch("activities.simulator_tasks.sim.get_live_state", return_value={})
    def test_unroutable_not_negative_cached(
        self, _live, mock_limits, _route, mock_cache, _skip
    ):
        from activities.simulator_tasks import _generate_route_waypoints

        mock_limits.return_value = {"brouter_route_attempts": 2}
        mock_cache.get.return_value = None
        waypoints, source = _generate_route_waypoints(52.23, 21.01, 5000, "RUN")
        self.assertEqual(source, "unroutable")
        self.assertEqual(waypoints, [])
        mock_cache.set.assert_not_called()

    @patch.dict(
        "os.environ",
        {
            "SCALE_SIM_STRICT_ROAD_ROUTES": "0",
            "SCALE_SIM_BROUTER_START_RADIUS_KM": "3",
        },
        clear=False,
    )
    @patch("activities.simulator_tasks._skip_brouter_now", return_value=False)
    @patch("activities.simulator_tasks.cache.get", return_value=None)
    @patch("activities.sim_routing.road_route_waypoints")
    @patch("activities.simulator_tasks._jitter_point_km", return_value=(52.24, 21.02))
    @patch("activities.scale_config.resolve_live_scale_limits")
    @patch("activities.simulator_tasks.sim.get_live_state", return_value={})
    def test_first_attempt_jitters_start(
        self, _live, mock_limits, mock_jitter, mock_route, _cache_get, _skip
    ):
        from activities.simulator_tasks import _generate_route_waypoints

        mock_limits.return_value = {"brouter_route_attempts": 1}
        mock_route.return_value = [(52.24, 21.02), (52.25, 21.03)]
        _generate_route_waypoints(52.23, 21.01, 5000, "RUN")
        mock_jitter.assert_called()
        mock_route.assert_called_once()
        args = mock_route.call_args[0]
        self.assertEqual(args[0], 52.24)
        self.assertEqual(args[1], 21.02)


class BrouterIslandEarlyExitTest(SimpleTestCase):
    @patch("activities.simulator_tasks._consume_brouter_tick_budget", return_value=True)
    @patch("activities.simulator_tasks.BRouterService.validate_track")
    def test_skips_trekking_fallback_on_unroutable_island(self, mock_validate, _budget):
        from activities.simulator_tasks import _brouter_route_waypoints

        mock_validate.return_value = {
            "success": False,
            "error": "target island reached, pass=0",
            "status_code": 400,
            "classification": {
                "code": BRouterService.UNROUTABLE_ERROR_CODE,
                "severity": "warning",
                "retryable": True,
            },
        }
        result = _brouter_route_waypoints(52.0, 21.0, 52.01, 21.01, "BIKE")
        self.assertIsNone(result)
        self.assertEqual(mock_validate.call_count, 1)

    @patch("activities.simulator_tasks._consume_brouter_tick_budget", return_value=True)
    @patch("activities.simulator_tasks._maybe_log_brouter_route_failure")
    @patch("activities.simulator_tasks.BRouterService.validate_track")
    def test_unroutable_log_mentions_island_section(
        self, mock_validate, mock_log, _budget
    ):
        from activities.simulator_tasks import _brouter_route_waypoints

        mock_validate.return_value = {
            "success": False,
            "error": "target island detected for section 0",
            "status_code": 400,
            "classification": {
                "code": BRouterService.UNROUTABLE_ERROR_CODE,
                "severity": "warning",
                "retryable": True,
            },
        }
        _brouter_route_waypoints(52.0, 21.0, 52.01, 21.01, "BIKE")
        mock_log.assert_called_once()
        reason = mock_log.call_args[0][0]
        self.assertIn("section 0", reason)
        self.assertNotIn("unroutable start", reason.lower())


class BatchBlocksLiveTest(SimpleTestCase):
    @patch("activities.simulator_state.is_batch_lock_held", return_value=True)
    @patch(
        "activities.simulator_state.get_batch_state",
        return_value={"running": False, "current_phase": "idle"},
    )
    def test_blocks_when_lock_held(self, _state, _lock):
        blocked, reason = sim.batch_blocks_live_simulation()
        self.assertTrue(blocked)
        self.assertIn("lock", reason)

    @patch("activities.simulator_state.is_batch_lock_held", return_value=False)
    @patch(
        "activities.simulator_state.get_batch_state",
        return_value={"running": True, "current_phase": "creating_users"},
    )
    def test_blocks_when_running(self, _state, _lock):
        blocked, reason = sim.batch_blocks_live_simulation()
        self.assertTrue(blocked)
        self.assertIn("running", reason)

    @patch("activities.simulator_state.is_batch_lock_held", return_value=False)
    @patch(
        "activities.simulator_state.get_batch_state",
        return_value={"running": False, "current_phase": "creating_users"},
    )
    def test_blocks_when_phase_in_progress(self, _state, _lock):
        blocked, _ = sim.batch_blocks_live_simulation()
        self.assertTrue(blocked)

    @patch("activities.simulator_state.is_batch_lock_held", return_value=False)
    @patch(
        "activities.simulator_state.get_batch_state",
        return_value={"running": False, "current_phase": "complete"},
    )
    def test_allows_when_complete(self, _state, _lock):
        blocked, reason = sim.batch_blocks_live_simulation()
        self.assertFalse(blocked)
        self.assertEqual(reason, "")


class SkipBrouterNowTest(SimpleTestCase):
    @patch.dict("os.environ", {"SCALE_SIM_SKIP_BROUTER": "1"}, clear=False)
    def test_skip_when_env_set(self):
        self.assertTrue(_skip_brouter_now())

    @patch.dict("os.environ", {"SCALE_SIM_SKIP_BROUTER": "0"}, clear=False)
    @patch("activities.simulator_tasks.sim.is_batch_lock_held", return_value=False)
    @patch("activities.simulator_tasks.sim.get_batch_state", return_value={"running": True})
    def test_no_skip_when_running_without_lock(self, _state, _lock):
        self.assertFalse(_skip_brouter_now())

    @patch.dict("os.environ", {"SCALE_SIM_SKIP_BROUTER": "0"}, clear=False)
    @patch("activities.simulator_tasks.sim.is_batch_lock_held", return_value=True)
    @patch("activities.simulator_tasks.sim.get_batch_state", return_value={"running": True})
    def test_skip_when_batch_lock_and_running(self, _state, _lock):
        self.assertTrue(_skip_brouter_now())


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
        warsaw = CITIES_BY_NAME["Warszawa"]
        user = SimpleNamespace(
            id=1,
            username="warszawa_athlete_000001",
            tenant=SimpleNamespace(name="Warszawa"),
        )
        self.assertEqual(resolve_city_for_user(user)["slug"], warsaw["slug"])

    def test_username_prefix_when_no_tenant(self):
        user = SimpleNamespace(id=2, username="krakow_athlete_000042", tenant=None)
        self.assertEqual(resolve_city_for_user(user)["slug"], "krakow")

    def test_stable_hash_fallback(self):
        user = SimpleNamespace(id=99, username="legacy_athlete", tenant=None)
        city = resolve_city_for_user(user)
        self.assertIn(city, CITIES)
        self.assertEqual(resolve_city_for_user(user)["slug"], city["slug"])


class PerCityRideCapTest(SimpleTestCase):
    def test_even_split_across_ten_cities(self):
        target = 2500
        n = len(CITIES)
        base = target // n
        extra = target % n
        caps = [base + (1 if i < extra else 0) for i in range(n)]
        self.assertEqual(sum(caps), target)
        self.assertGreaterEqual(min(caps), base)
