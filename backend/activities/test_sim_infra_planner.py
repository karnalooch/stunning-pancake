"""Tests for infra-derived live launch planner."""

from unittest.mock import patch

from django.test import SimpleTestCase

from activities.sim_infra_planner import build_live_launch_plan, read_infra_capacity


class SimInfraPlannerTest(SimpleTestCase):
    @patch.dict(
        "os.environ",
        {
            "SCALE_MAX_STARTS_PER_LIVE_TICK": "400",
            "SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK": "350",
            "SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK": "800",
            "SCALE_SIM_OPTIMAL_TICK_SECONDS": "4",
        },
        clear=False,
    )
    def test_plan_uses_env_caps(self):
        plan = build_live_launch_plan(1000, active_ratio=0.29, cheat_ratio=0.06)
        self.assertEqual(plan["scale_overrides"]["max_starts_per_live_tick"], 400)
        self.assertEqual(plan["tick_seconds"], 4)
        self.assertEqual(plan["target_on_map"], 290)
        self.assertGreater(plan["estimated_ramp_seconds"], 0)

    @patch.dict(
        "os.environ",
        {"SCALE_MAX_STARTS_PER_LIVE_TICK": "200"},
        clear=False,
    )
    def test_infra_snapshot(self):
        infra = read_infra_capacity()
        self.assertEqual(infra["max_starts_per_live_tick"], 200)
        self.assertIn("routing_dispatch_per_tick", infra)
