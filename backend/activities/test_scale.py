"""Tests for 300k-scale safeguards."""

from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from activities.scale_config import (
    MAX_CONCURRENT_RIDERS,
    MAX_BATCH_USERS,
    TELEMETRY_API_MAX_LIMIT,
    compute_batch_scaling,
    adaptive_pg_bulk_batch_size,
    adaptive_user_bulk_batch_size,
    live_pool_mode_for_target,
    plan_batch_cities,
    resolve_telemetry_api_limit,
)
from activities.scale_preflight import analyze_scale
from activities.services import TelemetryService


class ScaleConfigTest(SimpleTestCase):
    def test_limits_sane(self):
        self.assertGreaterEqual(MAX_BATCH_USERS, 300_000)
        self.assertLessEqual(MAX_CONCURRENT_RIDERS, 100_000)
        self.assertGreaterEqual(MAX_CONCURRENT_RIDERS, 5_000)

    def test_adaptive_batch_10k_100k_300k(self):
        for total, min_bulk, max_cities in (
            (10_000, 2500, 10),
            (100_000, 3500, 10),
            (300_000, 5000, 10),
        ):
            plan = compute_batch_scaling(total)
            self.assertLessEqual(plan["num_cities"], max_cities)
            self.assertGreaterEqual(plan["user_bulk_batch_size"], min_bulk)
            self.assertGreater(plan["users_per_city"], 1000)
            self.assertLessEqual(
                plan["num_cities"] * plan["users_per_city"],
                total + plan["num_cities"],
            )

    def test_plan_cities_bounded(self):
        n, upc = plan_batch_cities(300_000, max_cities_available=10)
        self.assertLessEqual(n, 10)
        self.assertGreaterEqual(upc, 15_000)

    def test_bulk_batch_scales_up(self):
        self.assertLessEqual(
            adaptive_user_bulk_batch_size(10_000),
            adaptive_user_bulk_batch_size(300_000),
        )

    def test_pg_batch_scales_down_with_users(self):
        bulk = adaptive_user_bulk_batch_size(300_000)
        self.assertGreater(
            adaptive_pg_bulk_batch_size(bulk, 1_000),
            adaptive_pg_bulk_batch_size(bulk, 300_000),
        )

    def test_live_pool_tiers(self):
        for total, mode, cap_check in (
            (1_000, "redis", lambda c: c == 1_000),
            (10_000, "redis", lambda c: c <= 50_000),
            (100_000, "db", lambda c: True),
            (300_000, "db", lambda c: True),
        ):
            plan = compute_batch_scaling(total)
            self.assertEqual(live_pool_mode_for_target(total), mode)
            self.assertEqual(plan["live_pool_mode"], mode)
            if mode == "redis":
                self.assertTrue(cap_check(plan["live_pool_redis_cap"]))
            self.assertGreater(plan["user_bulk_pg_batch_size"], 0)


class ScalePreflightTest(SimpleTestCase):
    @patch("activities.scale_preflight._telemetry_active_count", return_value=0)
    @patch("activities.scale_preflight.sim.get_live_state", return_value={"running": False})
    @patch("activities.scale_preflight.get_user_model")
    def test_300k_forces_skip_activities(self, mock_user_model, *_rest):
        mock_user_model.objects.filter.return_value.count.return_value = 0
        report = analyze_scale(300_000, active_ratio=0.3, skip_activities=False)
        self.assertTrue(report["force_skip_activities"])
        self.assertTrue(report["effective_skip_activities"])
        self.assertEqual(report["estimated_concurrent_riders"], MAX_CONCURRENT_RIDERS)
        self.assertIn("batch_plan", report)
        self.assertGreater(report["estimated_batch_seconds"], 0)

    @patch("activities.scale_preflight._telemetry_active_count", return_value=0)
    @patch("activities.scale_preflight.sim.get_live_state", return_value={"running": False})
    @patch("activities.scale_preflight.get_user_model")
    def test_50k_event_day_scenario(self, mock_user_model, *_rest):
        mock_user_model.objects.filter.return_value.count.return_value = 0
        report = analyze_scale(50_000, active_ratio=0.2, event_day=True)
        self.assertTrue(report["event_day"])
        self.assertGreaterEqual(report["max_concurrent_riders"], 5_000)
        areas = {r["area"] for r in report["risks"]}
        self.assertIn("event_burst", areas)


class TelemetryApiLimitTest(SimpleTestCase):
    def test_zoom_adaptive_cap(self):
        self.assertEqual(resolve_telemetry_api_limit(0, 6), 0)
        self.assertLessEqual(resolve_telemetry_api_limit(20_000, 6), 1_500)
        self.assertLessEqual(resolve_telemetry_api_limit(20_000, 9), 4_000)
        self.assertEqual(
            resolve_telemetry_api_limit(20_000, 14),
            min(20_000, TELEMETRY_API_MAX_LIMIT),
        )


class TelemetryServiceScaleTest(SimpleTestCase):
    def test_bbox_radius_positive(self):
        km = TelemetryService._bbox_radius_km(19.0, 52.0, 19.5, 52.5)
        self.assertGreater(km, 0)

    @patch("core.redis_cluster.get_redis")
    def test_get_live_positions_uses_geo(self, mock_get_redis):
        r = MagicMock()
        mock_get_redis.return_value = r
        r.hlen.return_value = 2
        r.georadius.return_value = [b"1", b"2"]
        r.hmget.return_value = [
            b'{"deviceId":"1","latitude":52.2,"longitude":19.1}',
            b'{"deviceId":"2","latitude":52.21,"longitude":19.11}',
        ]

        with patch("activities.services.requests.get") as mock_req:
            mock_req.side_effect = Exception("no traccar")
            positions, meta = TelemetryService.get_live_positions(
                bbox=(19.0, 52.0, 19.5, 52.5),
                limit=10,
            )

        self.assertEqual(len(positions), 2)
        r.georadius.assert_called_once()
        r.hgetall.assert_not_called()
        self.assertIn("returned", meta)
