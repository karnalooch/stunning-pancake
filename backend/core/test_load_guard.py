"""Global always-on load guard — pure decision core + FakeRedis integration.

Run:
  cd backend && python run_pytest.py core/test_load_guard.py -m simulator_light -v --tb=short
"""

from unittest.mock import patch

import pytest

pytestmark = pytest.mark.simulator_light

from django.test import SimpleTestCase

from core import load_guard as lg


class EvaluateSignalPureTest(SimpleTestCase):
    """No Redis — exercises the pure decision function directly."""

    def test_off_mode_always_allows(self):
        d = lg.evaluate_signal("join", 10_000, mode="off", limit=10, was_engaged=True)
        self.assertTrue(d.allowed)
        self.assertFalse(d.engaged)

    def test_disabled_limit_allows(self):
        d = lg.evaluate_signal("join", 10_000, mode="on", limit=0, was_engaged=False)
        self.assertTrue(d.allowed)

    def test_on_mode_allows_under_limit(self):
        d = lg.evaluate_signal("join", 5, mode="on", limit=10, was_engaged=False)
        self.assertTrue(d.allowed)
        self.assertFalse(d.engaged)

    def test_on_mode_rejects_over_limit(self):
        d = lg.evaluate_signal("join", 11, mode="on", limit=10, was_engaged=False)
        self.assertFalse(d.allowed)
        self.assertTrue(d.engaged)
        self.assertGreater(d.retry_after, 0)

    def test_auto_below_trip_not_engaged(self):
        # trip at 0.9 * 100 = 90
        d = lg.evaluate_signal(
            "join", 50, mode="auto", limit=100, was_engaged=False, engage_ratio_val=0.9
        )
        self.assertTrue(d.allowed)
        self.assertFalse(d.engaged)

    def test_auto_at_trip_engages_but_allows(self):
        d = lg.evaluate_signal(
            "join", 95, mode="auto", limit=100, was_engaged=False, engage_ratio_val=0.9
        )
        self.assertTrue(d.allowed)
        self.assertTrue(d.engaged)

    def test_auto_engaged_over_limit_rejects(self):
        d = lg.evaluate_signal(
            "join", 105, mode="auto", limit=100, was_engaged=True, engage_ratio_val=0.9
        )
        self.assertFalse(d.allowed)
        self.assertTrue(d.engaged)
        self.assertGreater(d.retry_after, 0)

    def test_ingest_retry_after_is_one_second(self):
        d = lg.evaluate_signal("ingest", 50, mode="on", limit=10, was_engaged=False)
        self.assertFalse(d.allowed)
        self.assertEqual(d.retry_after, 1)


class ConfigTest(SimpleTestCase):
    @patch.dict("os.environ", {"GLOBAL_PROTECTION_MODE": "on"}, clear=False)
    def test_mode_on(self):
        self.assertEqual(lg.global_protection_mode(), "on")

    @patch.dict("os.environ", {"GLOBAL_PROTECTION_MODE": "0"}, clear=False)
    def test_mode_legacy_off(self):
        self.assertEqual(lg.global_protection_mode(), "off")

    @patch.dict("os.environ", {}, clear=False)
    def test_mode_default_auto(self):
        import os

        os.environ.pop("GLOBAL_PROTECTION_MODE", None)
        self.assertEqual(lg.global_protection_mode(), "auto")

    @patch.dict("os.environ", {"GLOBAL_MAX_JOIN_PER_MINUTE": "1234"}, clear=False)
    def test_signal_limit_env(self):
        self.assertEqual(lg.signal_limit(lg.SIGNAL_JOIN), 1234)


class CheckSignalRedisTest(SimpleTestCase):
    """Integration with FakeRedis sliding window (installed by simulator_light)."""

    @patch.dict(
        "os.environ",
        {"GLOBAL_PROTECTION_MODE": "off"},
        clear=False,
    )
    def test_off_mode_no_throttle_ever(self):
        for _ in range(50):
            d = lg.check_join()
        self.assertTrue(d.allowed)

    @patch.dict(
        "os.environ",
        {"GLOBAL_PROTECTION_MODE": "on", "GLOBAL_MAX_JOIN_PER_MINUTE": "5"},
        clear=False,
    )
    def test_on_mode_throttles_after_limit(self):
        results = [lg.check_join().allowed for _ in range(8)]
        # First 5 allowed, the rest rejected.
        self.assertTrue(all(results[:5]))
        self.assertFalse(results[-1])

    @patch.dict(
        "os.environ",
        {
            "GLOBAL_PROTECTION_MODE": "auto",
            "GLOBAL_MAX_SESSION_PER_MINUTE": "4",
            "GLOBAL_PROTECTION_ENGAGE_RATIO": "0.5",
        },
        clear=False,
    )
    def test_auto_mode_engages_and_throttles(self):
        results = [lg.check_session_start().allowed for _ in range(7)]
        self.assertTrue(results[0])
        self.assertFalse(results[-1])

    @patch.dict(
        "os.environ",
        {"GLOBAL_PROTECTION_MODE": "on", "GLOBAL_MAX_INGEST_PER_SECOND": "10"},
        clear=False,
    )
    def test_ingest_batch_counts_as_n(self):
        # A single batch of 20 exceeds the per-second cap of 10.
        d = lg.check_ingest(20)
        self.assertFalse(d.allowed)


class ConcurrentCapTest(SimpleTestCase):
    @patch.dict(
        "os.environ",
        {"GLOBAL_PROTECTION_MODE": "auto", "GLOBAL_MAX_CONCURRENT_RIDERS": "12000"},
        clear=False,
    )
    @patch("events.burst.effective_event_concurrent_cap", return_value=50_000)
    def test_caps_at_platform_ceiling(self, _evt):
        self.assertEqual(lg.global_concurrent_cap({}), 12_000)

    @patch.dict(
        "os.environ",
        {"GLOBAL_PROTECTION_MODE": "auto", "GLOBAL_MAX_CONCURRENT_RIDERS": "60000"},
        clear=False,
    )
    @patch("events.burst.effective_event_concurrent_cap", return_value=10_000)
    def test_event_cap_wins_when_lower(self, _evt):
        self.assertEqual(lg.global_concurrent_cap({"event_id": "1"}), 10_000)

    @patch.dict("os.environ", {"GLOBAL_PROTECTION_MODE": "off"}, clear=False)
    @patch("events.burst.effective_event_concurrent_cap", return_value=10_000)
    def test_off_mode_defers_to_event_cap(self, _evt):
        self.assertEqual(lg.global_concurrent_cap({}), 10_000)


class SnapshotTest(SimpleTestCase):
    @patch.dict("os.environ", {"GLOBAL_PROTECTION_MODE": "auto"}, clear=False)
    def test_snapshot_shape(self):
        snap = lg.guard_snapshot()
        self.assertIn("mode", snap)
        self.assertIn("join", snap["signals"])
        self.assertIn("ingest", snap["signals"])
        self.assertIn("concurrent_cap", snap)
