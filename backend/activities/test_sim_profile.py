"""Tests for sim profile mapping and backpressure active_ratio auto-lower."""

import time
from unittest.mock import patch

from django.test import SimpleTestCase

from activities.sim_profile import (
    evaluate_backpressure_active_ratio_lower,
    map_intensity,
    map_load,
    parse_intensity_load_from_request,
    piecewise_lerp,
    resolve_sim_profile,
)
from activities.simulator_tasks import _ramp_start_delay_max, _sample_athlete_motion_profile


class SimProfileMappingTest(SimpleTestCase):
    def test_piecewise_midpoint(self):
        self.assertEqual(piecewise_lerp([(0, 25), (50, 50), (75, 100), (100, 1000)], 50), 50.0)

    def test_intensity_defaults(self):
        m = map_intensity(50)
        self.assertAlmostEqual(m["active_ratio"], 0.29, places=2)
        self.assertAlmostEqual(m["cheat_ratio"], 0.06, places=2)

    def test_intensity_clamps(self):
        low = map_intensity(0)
        self.assertEqual(low["active_ratio"], 0.08)
        high = map_intensity(100)
        self.assertEqual(high["active_ratio"], 0.50)
        self.assertAlmostEqual(high["cheat_ratio"], 0.12, places=2)

    def test_load_mid_and_high(self):
        mid = map_load(50)
        self.assertEqual(mid["max_starts_per_live_tick"], 50)
        self.assertEqual(mid["brouter_max_calls_per_tick"], 42)
        self.assertEqual(mid["brouter_route_attempts"], 4)
        self.assertEqual(mid["tick_seconds"], 8)
        turbo = map_load(75)
        self.assertEqual(turbo["max_starts_per_live_tick"], 100)
        high = map_load(100)
        self.assertEqual(high["max_starts_per_live_tick"], 1000)
        self.assertEqual(high["brouter_route_attempts"], 5)
        self.assertEqual(high["tick_seconds"], 6)

    def test_resolve_sim_profile_50_50(self):
        p = resolve_sim_profile(50, 50)
        self.assertEqual(p["intensity"], 50)
        self.assertEqual(p["load"], 50)
        self.assertIn("scale_overrides", p)
        self.assertEqual(p["scale_overrides"]["max_starts_per_live_tick"], 50)

    def test_parse_request_requires_both(self):
        profile, err = parse_intensity_load_from_request({"intensity": 50})
        self.assertIsNone(profile)
        self.assertIn("together", err or "")

    def test_parse_request_ok(self):
        profile, err = parse_intensity_load_from_request({"intensity": 50, "load": 50})
        self.assertIsNone(err)
        self.assertEqual(profile["intensity"], 50)


class RampStartDelayTest(SimpleTestCase):
    def test_ramp_active_early(self):
        state = {"started_at": time.time(), "tick_seconds": 8}
        self.assertEqual(_ramp_start_delay_max(state), 20)

    def test_ramp_off_after_window(self):
        state = {"started_at": time.time() - 200, "tick_seconds": 8}
        self.assertIsNone(_ramp_start_delay_max(state))

    @patch.dict("os.environ", {"SCALE_SIM_RAMP_TICKS": "0"}, clear=False)
    def test_ramp_disabled_via_ticks(self):
        state = {"started_at": time.time(), "tick_seconds": 8}
        self.assertIsNone(_ramp_start_delay_max(state))

    def test_motion_respects_ramp_cap(self):
        with patch(
            "activities.simulator_tasks.random.randint",
            return_value=15,
        ):
            motion = _sample_athlete_motion_profile("RUN", start_delay_max=20)
        self.assertEqual(motion["start_delay_s"], 15)


class BackpressureActiveRatioLowerTest(SimpleTestCase):
    def test_no_lower_before_threshold(self):
        ratio, ticks, lowered = evaluate_backpressure_active_ratio_lower(
            backpressure_active=True,
            consecutive_bp_ticks=4,
            current_active_ratio=0.3,
            enabled=True,
            after_ticks=6,
        )
        self.assertEqual(ratio, 0.3)
        self.assertEqual(ticks, 5)
        self.assertFalse(lowered)

    def test_lowers_at_threshold(self):
        ratio, ticks, lowered = evaluate_backpressure_active_ratio_lower(
            backpressure_active=True,
            consecutive_bp_ticks=11,
            current_active_ratio=0.3,
            enabled=True,
            after_ticks=12,
        )
        self.assertTrue(lowered)
        self.assertEqual(ticks, 0)
        self.assertAlmostEqual(ratio, 0.3 * 0.95, places=3)

    def test_resets_when_backpressure_off(self):
        ratio, ticks, lowered = evaluate_backpressure_active_ratio_lower(
            backpressure_active=False,
            consecutive_bp_ticks=10,
            current_active_ratio=0.2,
            enabled=True,
            after_ticks=6,
        )
        self.assertEqual(ratio, 0.2)
        self.assertEqual(ticks, 0)
        self.assertFalse(lowered)

    def test_disabled(self):
        ratio, ticks, lowered = evaluate_backpressure_active_ratio_lower(
            backpressure_active=True,
            consecutive_bp_ticks=99,
            current_active_ratio=0.4,
            enabled=False,
            after_ticks=6,
        )
        self.assertEqual(ratio, 0.4)
        self.assertFalse(lowered)
