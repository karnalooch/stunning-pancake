"""Paczka 1b — routing backpressure (pure unit) and sim KPI wiring (mocked).

Avoid real Redis hgetall on live rides and broker inspect — those can OOM on dev
Redis left over from load tests. Run locally:

  cd backend && python run_pytest.py activities/test_simulator_backpressure.py -m simulator_light -v
"""

import pytest
from unittest.mock import MagicMock, patch

pytestmark = pytest.mark.simulator_light

from django.test import SimpleTestCase

from activities import simulator_routing_backpressure as bp

_FSM_IDLE = {
    "ride_warming": 0,
    "ride_routing": 0,
    "ride_pending_route": 0,
    "ride_routed": 0,
    "ride_active": 0,
    "ride_on_map": 0,
}


class RoutingBackpressureLogicTest(SimpleTestCase):
    def setUp(self):
        self._broker_patch = patch(
            "activities.simulator_routing_backpressure.get_broker_routing_queue_depth",
            return_value=None,
        )
        self._broker_patch.start()

    def tearDown(self):
        self._broker_patch.stop()

    @patch.dict("os.environ", {"SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH": "50"}, clear=False)
    def test_backpressure_active_at_cap(self):
        snap = bp.routing_backpressure_snapshot(fsm_pending=50)
        self.assertTrue(snap["routing_backpressure_active"])
        self.assertEqual(snap["routing_queue_depth"], 50)

    @patch.dict("os.environ", {"SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH": ""}, clear=False)
    def test_no_backpressure_when_cap_unset(self):
        snap = bp.routing_backpressure_snapshot(fsm_pending=8)
        self.assertFalse(snap["routing_backpressure_active"])
        self.assertIsNone(snap["max_routing_queue_depth"])

    @patch.dict("os.environ", {"SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH": "10"}, clear=False)
    def test_effective_cap_reduced_not_zero_when_active(self):
        with patch(
            "activities.simulator_routing_backpressure.get_broker_routing_queue_depth",
            return_value=12,
        ):
            snap = bp.routing_backpressure_snapshot(fsm_pending=12, fsm_routing=0)
        cap, throttled = bp.effective_routing_dispatch_cap(30, snap, starters_remaining=5)
        self.assertGreater(cap, 0)
        self.assertTrue(throttled)
        self.assertLess(cap, 30)

    @patch.dict("os.environ", {"SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH": "10"}, clear=False)
    def test_effective_cap_zero_when_deep_over_cap(self):
        with patch(
            "activities.simulator_routing_backpressure.get_broker_routing_queue_depth",
            return_value=40,
        ):
            snap = bp.routing_backpressure_snapshot(fsm_pending=5, fsm_routing=0)
        with patch.dict(
            "os.environ",
            {"SIM_BP_MIN_DISPATCH_PER_TICK": "8", "SIM_BP_QUEUE_HEADROOM": "5"},
            clear=False,
        ):
            cap, throttled = bp.effective_routing_dispatch_cap(30, snap, starters_remaining=5)
        self.assertEqual(cap, 8)
        self.assertTrue(throttled)

    @patch.dict("os.environ", {"SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH": "100"}, clear=False)
    def test_low_load_unchanged_cap(self):
        snap = bp.routing_backpressure_snapshot(fsm_pending=2)
        cap, throttled = bp.effective_routing_dispatch_cap(30, snap, starters_remaining=5)
        self.assertEqual(cap, 30)
        self.assertFalse(throttled)

    @patch.dict("os.environ", {"SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH": "60"}, clear=False)
    def test_depth_uses_broker_when_higher(self):
        with patch(
            "activities.simulator_routing_backpressure.get_broker_routing_queue_depth",
            return_value=80,
        ):
            snap = bp.routing_backpressure_snapshot(fsm_pending=5, fsm_routing=2)
        self.assertEqual(snap["routing_queue_depth"], 82)
        self.assertTrue(snap["routing_backpressure_active"])


class SimKpiSnapshotMockedTest(SimpleTestCase):
    @patch("activities.simulator_state.is_live_lock_held", return_value=False)
    @patch("activities.simulator_state.live_tick_stale", return_value=False)
    @patch("activities.simulator_tasks._async_routing_enabled", return_value=True)
    @patch(
        "activities.simulator_routing_backpressure.routing_backpressure_snapshot",
        return_value={
            "routing_queue_depth": 0,
            "routing_backpressure_active": False,
        },
    )
    @patch("activities.ride_fsm.fsm_summary", return_value=_FSM_IDLE)
    @patch("activities.simulator_state.get_live_rides", return_value={})
    @patch(
        "activities.simulator_state.get_live_state",
        return_value={"running": False},
    )
    @patch(
        "activities.simulator_state.get_batch_state",
        return_value={"running": False, "current_phase": "idle"},
    )
    def test_build_sim_kpi_when_idle(self, *_mocks):
        from activities.admin_stats import build_sim_kpi_snapshot

        kpi = build_sim_kpi_snapshot()
        self.assertFalse(kpi["sim_on"])
        self.assertFalse(kpi["live_running"])
        self.assertIn("ride_warming", kpi)
        self.assertTrue(kpi["async_routing_enabled"])


class DashboardStatsSimKpiTest(SimpleTestCase):
    @patch("activities.admin_stats.set_cached_dashboard_stats")
    @patch("activities.admin_stats._per_department_breakdown", return_value=[])
    @patch("activities.admin_stats._per_tenant_breakdown", return_value=[])
    @patch("activities.admin_stats._scoped_tenant_id", return_value=None)
    @patch("activities.admin_stats._batch_or_live_running", return_value=False)
    @patch("activities.admin_stats.get_cached_dashboard_stats", return_value=None)
    @patch("activities.admin_stats.build_sim_kpi_snapshot")
    @patch("activities.admin_stats.Activity")
    @patch("activities.admin_stats.get_user_model")
    def test_global_owner_stats_include_sim_kpi(
        self,
        mock_user_model,
        mock_activity,
        mock_kpi,
        *_cache,
    ):
        from activities.admin_stats import build_dashboard_stats

        mock_kpi.return_value = {"sim_on": False, "async_routing_enabled": True}
        mock_activity.objects.all.return_value.aggregate.return_value = {
            "total_activities": 0,
            "total_distance": 0,
            "verified_total": 0,
            "new_activities_last_7d": 0,
        }
        mock_user_model.return_value.objects.all.return_value.aggregate.return_value = {
            "total_users": 1,
            "new_users_today": 0,
            "new_users_last_7d": 0,
        }
        owner = MagicMock(role="GLOBAL_OWNER", tenant_id=None)

        stats = build_dashboard_stats(owner, refresh=True)

        self.assertIn("sim_kpi", stats)
        self.assertIn("async_routing_enabled", stats["sim_kpi"])
        mock_kpi.assert_called_once()
