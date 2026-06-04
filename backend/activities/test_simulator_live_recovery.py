"""Tests for live-sim worker recovery and BRouter per-tick budget."""

import time
from unittest.mock import patch

from django.test import SimpleTestCase

from activities import simulator_tasks as tasks
from activities import simulator_state as sim


class BrouterTickBudgetTest(SimpleTestCase):
    @patch("activities.scale_config.BROUTER_MAX_CALLS_PER_TICK", 3)
    def test_budget_caps_http_calls(self):
        tasks._reset_brouter_tick_budget()
        self.assertTrue(tasks._consume_brouter_tick_budget())
        self.assertTrue(tasks._consume_brouter_tick_budget())
        self.assertTrue(tasks._consume_brouter_tick_budget())
        self.assertFalse(tasks._consume_brouter_tick_budget())

    @patch("activities.scale_config.BROUTER_MAX_CALLS_PER_TICK", 0)
    def test_zero_budget_means_unlimited(self):
        tasks._reset_brouter_tick_budget()
        for _ in range(10):
            self.assertTrue(tasks._consume_brouter_tick_budget())


class LiveTickStaleTest(SimpleTestCase):
    @patch("activities.simulator_state.get_live_state")
    def test_stale_when_running_without_recent_tick(self, mock_state):
        mock_state.return_value = {
            "running": True,
            "tick_seconds": 8,
            "last_tick_at": time.time() - 120,
        }
        self.assertTrue(sim.live_tick_stale())

    @patch("activities.simulator_state.get_live_state")
    def test_not_stale_when_recent_tick(self, mock_state):
        mock_state.return_value = {
            "running": True,
            "tick_seconds": 8,
            "last_tick_at": time.time() - 2,
        }
        self.assertFalse(sim.live_tick_stale())


class MaybeAdvanceLiveTest(SimpleTestCase):
    @patch("activities.simulator_tasks.live_tick_task")
    @patch("activities.simulator_state.set_live_state")
    @patch("activities.simulator_state.live_tick_stale", return_value=False)
    @patch("activities.simulator_state.get_live_state")
    def test_does_not_bump_last_tick_before_enqueue(self, mock_state, _stale, mock_set, mock_task):
        now = time.time()
        mock_state.return_value = {
            "running": True,
            "tick_seconds": 8,
            "last_tick_at": now - 20,
        }
        self.assertTrue(sim.maybe_advance_live_simulation())
        mock_task.delay.assert_called_once()
        mock_set.assert_not_called()


class HealStaleLiveTest(SimpleTestCase):
    @patch("activities.simulator_state.live_log")
    @patch("activities.simulator_tasks.run_live_simulation")
    @patch("activities.simulator_state.set_live_state")
    @patch("activities.simulator_state.get_redis")
    @patch("activities.simulator_state.is_live_lock_held", return_value=False)
    @patch("activities.simulator_state.live_tick_stale", return_value=True)
    @patch("activities.simulator_state.get_live_state")
    def test_reschedules_runner_when_stale(
        self,
        mock_state,
        _stale,
        _lock,
        mock_redis,
        _set,
        mock_runner,
        _log,
    ):
        mock_redis.return_value.exists.return_value = False
        mock_state.return_value = {"running": True, "tick_seconds": 8, "last_tick_at": 0}
        out = sim.heal_stale_live_simulation(reschedule=True)
        self.assertTrue(out["healed"])
        mock_runner.delay.assert_called_once()

    @patch("activities.simulator_state.live_log")
    @patch("activities.simulator_tasks.run_live_simulation")
    @patch("activities.simulator_state.set_live_state")
    @patch("activities.simulator_state._heal_cooldown_ok", return_value=True)
    @patch("activities.simulator_state.get_redis")
    @patch("activities.simulator_state.is_live_lock_held", return_value=True)
    @patch("activities.simulator_state.live_tick_stale", return_value=True)
    @patch("activities.simulator_state.get_live_state")
    def test_reschedules_runner_when_stale_with_lock_held(
        self,
        mock_state,
        _stale,
        _lock,
        mock_redis,
        _cooldown,
        _set,
        mock_runner,
        _log,
    ):
        mock_redis.return_value.exists.return_value = False
        mock_state.return_value = {"running": True, "tick_seconds": 6, "last_tick_at": 0}
        out = sim.heal_stale_live_simulation(reschedule=True)
        self.assertTrue(out["healed"])
        mock_runner.delay.assert_called_once()
        self.assertIn("rescheduled_live_runner", out["actions"])
