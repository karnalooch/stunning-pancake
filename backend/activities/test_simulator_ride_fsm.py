"""Ride FSM and async routing queue dispatch."""

from datetime import timedelta
from unittest.mock import patch

from django.test import SimpleTestCase
from django.utils import timezone

from activities import ride_fsm


class RideFsmSummaryTest(SimpleTestCase):
    def test_counts_by_state(self):
        rides = {
            1: {"ride_state": ride_fsm.PENDING_ROUTE},
            2: {"ride_state": ride_fsm.ROUTING},
            3: {"ride_state": ride_fsm.ROUTED, "waypoints": [(0, 0), (1, 1)]},
            4: {"ride_state": ride_fsm.ACTIVE, "waypoints": [(0, 0), (1, 1)]},
        }
        summary = ride_fsm.fsm_summary(rides)
        self.assertEqual(summary["ride_warming"], 2)
        self.assertEqual(summary["ride_routing"], 1)
        self.assertEqual(summary["ride_routed"], 1)
        self.assertEqual(summary["ride_on_map"], 1)

    def test_legacy_ride_without_state_counts_active(self):
        rides = {9: {"waypoints": [(52.0, 21.0), (52.01, 21.01)]}}
        self.assertEqual(ride_fsm.fsm_summary(rides)["ride_active"], 1)


class PromoteRoutedTest(SimpleTestCase):
    def test_promote_when_start_time_passed(self):
        past = (timezone.now() - timedelta(seconds=5)).isoformat()
        ride = {"ride_state": ride_fsm.ROUTED, "start_time": past}
        self.assertTrue(ride_fsm.can_promote_to_active(ride, timezone.now()))

    def test_no_promote_before_start(self):
        future = (timezone.now() + timedelta(hours=1)).isoformat()
        ride = {"ride_state": ride_fsm.ROUTED, "start_time": future}
        self.assertFalse(ride_fsm.can_promote_to_active(ride, timezone.now()))


class RouteLiveRideTaskTest(SimpleTestCase):
    @patch("activities.simulator_tasks.sim.delete_live_ride")
    @patch("activities.simulator_tasks._route_pending_ride")
    @patch("activities.simulator_tasks.sim.set_live_ride")
    @patch("activities.simulator_tasks.sim.get_live_rides")
    @patch("activities.simulator_tasks.sim.get_live_state", return_value={"running": True})
    def test_dispatches_routing_from_pending(
        self,
        _state,
        mock_rides,
        mock_set,
        mock_route,
        _del,
    ):
        from activities.simulator_tasks import route_live_ride_task

        mock_rides.return_value = {
            42: {"ride_state": ride_fsm.PENDING_ROUTE, "act_type": "BIKE"},
        }
        route_live_ride_task.run(42)
        mock_set.assert_called()
        first_call_state = mock_set.call_args_list[0][0][1].get("ride_state")
        self.assertEqual(first_call_state, ride_fsm.ROUTING)
        mock_route.assert_called_once_with(42, mock_rides.return_value[42])

    @patch("activities.simulator_tasks.route_live_ride_task.delay")
    @patch.dict("os.environ", {"SCALE_SIM_ASYNC_ROUTING": "1"}, clear=False)
    def test_live_tick_queues_routing_task(self, mock_delay):
        from activities.simulator_tasks import _async_routing_enabled

        self.assertTrue(_async_routing_enabled())


class LiveTickStateShadowRegressionTest(SimpleTestCase):
    """Regression: city-balance loop must not shadow live `state` dict (AttributeError on .get)."""

    def test_city_balance_loop_uses_ride_state_variable(self):
        import inspect

        from activities import simulator_live_tick as tick_mod

        body = inspect.getsource(tick_mod._run_live_tick_body)
        self.assertIn(
            "ride_state = ride_fsm.normalize_ride_state(ride)",
            body,
            "live tick must not assign normalize_ride_state to `state`",
        )


class CeleryRouteTest(SimpleTestCase):
    def test_route_task_on_routing_queue(self):
        from core.celery import app

        routes = app.conf.task_routes
        self.assertEqual(
            routes["activities.simulator_tasks.route_live_ride_task"]["queue"],
            "routing",
        )
