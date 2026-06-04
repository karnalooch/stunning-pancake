"""Large-pool clamps and OSRM ready wait."""

from __future__ import annotations

import time
from unittest.mock import patch

import pytest
from django.test import SimpleTestCase

from activities import simulator_state as sim
from activities.sim_live_guards import clamp_live_params_for_large_pool, wait_for_osrm_ready

pytestmark = pytest.mark.simulator_light


class LargePoolClampTest(SimpleTestCase):
    def test_no_clamp_small_pool(self):
        out = clamp_live_params_for_large_pool(1000, 0.5, 6)
        self.assertFalse(out.applied)
        self.assertEqual(out.active_ratio, 0.5)
        self.assertEqual(out.tick_seconds, 6)

    def test_clamp_10k_pool(self):
        out = clamp_live_params_for_large_pool(9990, 0.5, 6)
        self.assertTrue(out.applied)
        self.assertEqual(out.active_ratio, 0.25)
        self.assertEqual(out.tick_seconds, 10)


class LiveTickStaleLoadTest(SimpleTestCase):
    @patch("activities.simulator_state.get_live_rides_in_flight_count", return_value=800)
    @patch("activities.simulator_state.get_live_state")
    def test_not_stale_when_heavy_map_short_gap(self, mock_state, _inflight):
        mock_state.return_value = {
            "running": True,
            "tick_seconds": 6,
            "last_tick_at": time.time() - 35,
            "last_runner_at": time.time() - 35,
            "currently_riding": 785,
        }
        self.assertFalse(sim.live_tick_stale())


class OsrmReadyWaitTest(SimpleTestCase):
    @patch.dict("os.environ", {"RAILWAY_OSRM_READY_MAX_WAIT_S": "0"}, clear=False)
    @patch("activities.osrm_service.OsrmService.health_check", return_value=True)
    def test_immediate_ok(self, _hc):
        out = wait_for_osrm_ready(max_wait_seconds=0)
        self.assertTrue(out.ready)
