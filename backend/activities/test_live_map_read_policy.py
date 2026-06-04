"""ADR 011 P2 — live map read shedding when ingest guard is engaged."""

from unittest import TestCase
from unittest.mock import patch

from activities.telemetry_shard import (
    LiveMapReadPolicy,
    apply_live_map_cap,
    live_map_read_policy,
)


class LiveMapReadPolicyTests(TestCase):
    @patch("activities.telemetry_shard.ingest_guard_engaged", return_value=False)
    def test_idle_policy_no_throttle(self, _mock):
        policy = live_map_read_policy()
        self.assertFalse(policy.ingest_engaged)
        self.assertEqual(policy.poll_interval_multiplier, 1.0)
        self.assertEqual(apply_live_map_cap(2000, policy), 2000)

    @patch("activities.telemetry_shard.ingest_guard_engaged", return_value=True)
    def test_engaged_policy_reduces_cap(self, _mock):
        policy = live_map_read_policy()
        self.assertTrue(policy.ingest_engaged)
        self.assertGreater(policy.poll_interval_multiplier, 1.0)
        self.assertEqual(policy.detail_ceiling, "standard")
        reduced = apply_live_map_cap(2000, policy)
        self.assertLess(reduced, 2000)
        self.assertGreaterEqual(reduced, 1)

    def test_apply_cap_respects_zero(self):
        policy = LiveMapReadPolicy(
            ingest_engaged=True,
            cap_multiplier=0.35,
            poll_interval_multiplier=2.5,
            cache_ttl_seconds=8,
            detail_ceiling="standard",
        )
        self.assertEqual(apply_live_map_cap(0, policy), 0)
