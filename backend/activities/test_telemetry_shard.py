"""Telemetry horizontal sharding — pure router + TelemetryService round-trips.

Run:
  cd backend && python run_pytest.py activities/test_telemetry_shard.py -m simulator_light -v --tb=short
"""

import pytest
from unittest.mock import patch

pytestmark = pytest.mark.simulator_light

from django.test import SimpleTestCase

from activities import telemetry_shard as ts


class ShardRouterPureTest(SimpleTestCase):
    def test_default_single_shard(self):
        with patch.dict("os.environ", {}, clear=False):
            import os

            os.environ.pop("TELEMETRY_SHARD_COUNT", None)
            self.assertEqual(ts.shard_count(), 1)
            self.assertFalse(ts.is_sharding_enabled())

    def test_legacy_keys_when_single_shard(self):
        sk = ts.shard_keys(0, count=1)
        self.assertEqual(sk.positions, "telemetry:positions")
        self.assertEqual(sk.geo, "telemetry:geo")

    def test_sharded_keys_use_hash_tag(self):
        sk = ts.shard_keys(3, count=8)
        self.assertEqual(sk.positions, "{tel:3}:telemetry:positions")
        self.assertEqual(sk.geo, "{tel:3}:telemetry:geo")

    def test_shard_for_device_is_deterministic(self):
        a = ts.shard_for_device("device-42", count=8)
        b = ts.shard_for_device("device-42", count=8)
        self.assertEqual(a, b)
        self.assertTrue(0 <= a < 8)

    def test_shard_for_device_single_shard_is_zero(self):
        self.assertEqual(ts.shard_for_device("anything", count=1), 0)

    def test_shard_count_hard_capped(self):
        with patch.dict("os.environ", {"TELEMETRY_SHARD_COUNT": "9999"}, clear=False):
            self.assertEqual(ts.shard_count(), 256)
        with patch.dict("os.environ", {"TELEMETRY_SHARD_COUNT": "0"}, clear=False):
            self.assertEqual(ts.shard_count(), 1)

    def test_group_devices_distributes(self):
        ids = [f"dev-{i}" for i in range(200)]
        buckets = ts.group_devices_by_shard(ids, count=8)
        # All devices accounted for, and more than one shard used.
        self.assertEqual(sum(len(v) for v in buckets.values()), 200)
        self.assertGreater(len(buckets), 1)

    def test_all_shard_keys_count(self):
        self.assertEqual(len(ts.all_shard_keys(count=4)), 4)
        self.assertEqual(len(ts.all_shard_keys(count=1)), 1)


class TelemetryServiceShardRoundTripTest(SimpleTestCase):
    def _push_grid(self, n: int):
        from activities.services import TelemetryService

        for i in range(n):
            TelemetryService.push_simulator_position(
                device_id=f"rider-{i}",
                lat=52.23 + (i * 0.0005),
                lon=21.0 + (i * 0.0005),
                speed=10.0,
                name=f"Rider {i}",
            )

    @patch.dict("os.environ", {"TELEMETRY_SHARD_COUNT": "1"}, clear=False)
    def test_single_shard_roundtrip(self):
        from activities.services import TelemetryService

        self._push_grid(10)
        positions, meta = TelemetryService.get_live_positions(
            bbox=(20.5, 51.8, 21.5, 52.7),
            limit=100,
        )
        self.assertEqual(len(positions), 10)
        self.assertEqual(meta["telemetry_positions"], 10)

    @patch.dict("os.environ", {"TELEMETRY_SHARD_COUNT": "4"}, clear=False)
    def test_sharded_roundtrip_merges_all_shards(self):
        from activities.services import TelemetryService

        self._push_grid(20)
        positions, meta = TelemetryService.get_live_positions(
            bbox=(20.5, 51.8, 21.5, 52.8),
            limit=100,
        )
        device_ids = {p.get("deviceId") for p in positions}
        self.assertEqual(len(device_ids), 20)
        self.assertEqual(meta["telemetry_positions"], 20)

    @patch.dict("os.environ", {"TELEMETRY_SHARD_COUNT": "4"}, clear=False)
    def test_bulk_replace_then_clear(self):
        from activities.services import TelemetryService

        entries = [
            {
                "deviceId": f"bulk-{i}",
                "lat": 52.23 + i * 0.0005,
                "lng": 21.0 + i * 0.0005,
                "speed": 5,
                "name": f"B{i}",
                "type": "person",
            }
            for i in range(15)
        ]
        TelemetryService.push_bulk_positions(entries)
        positions, meta = TelemetryService.get_live_positions(
            bbox=(20.5, 51.8, 21.5, 52.8),
            limit=100,
        )
        self.assertEqual(meta["telemetry_positions"], 15)
        self.assertEqual(len(positions), 15)

        TelemetryService.clear_simulator_positions()
        # Verify directly against shards (get_live_positions has a short-TTL cache
        # that FakeRedis does not expire).
        from core.redis_cluster import get_redis

        r = get_redis()
        remaining = sum(int(r.hlen(sk.positions) or 0) for sk in ts.all_shard_keys(count=4))
        self.assertEqual(remaining, 0)

    @patch.dict("os.environ", {"TELEMETRY_SHARD_COUNT": "4"}, clear=False)
    def test_writes_land_on_multiple_shards(self):
        """Confirm sharding actually spreads keys (not all in one shard)."""
        from activities.services import TelemetryService
        from core.redis_cluster import get_redis

        self._push_grid(40)
        r = get_redis()
        non_empty = 0
        for sk in ts.all_shard_keys(count=4):
            if int(r.hlen(sk.positions) or 0) > 0:
                non_empty += 1
        self.assertGreater(non_empty, 1)
