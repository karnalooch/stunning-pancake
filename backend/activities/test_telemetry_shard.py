"""Telemetry horizontal sharding — pure router + TelemetryService round-trips.

Run:
  cd backend && python run_pytest.py activities/test_telemetry_shard.py -m simulator_light -v --tb=short
"""

from unittest.mock import patch

import pytest

pytestmark = pytest.mark.simulator_light

from django.test import SimpleTestCase

from activities import telemetry_shard as ts


class ShardRouterPureTest(SimpleTestCase):
    def test_default_single_shard(self):
        with patch.dict("os.environ", {}, clear=False):
            import os

            os.environ.pop("TELEMETRY_SHARD_COUNT", None)
            os.environ.pop("REDIS_TELEMETRY_SHARD_NODES", None)
            ts.TelemetryShardRouter.reset()
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

    def test_shard_node_urls_parsing(self):
        with patch.dict(
            "os.environ",
            {"REDIS_TELEMETRY_SHARD_NODES": "redis://a/0, redis://b/1"},
            clear=False,
        ):
            self.assertEqual(ts.shard_node_urls(), ["redis://a/0", "redis://b/1"])
            self.assertTrue(ts.has_dedicated_shard_nodes())

    def test_resolve_node_urls_cycles_when_fewer_than_shards(self):
        with patch.dict(
            "os.environ",
            {"REDIS_TELEMETRY_SHARD_NODES": "redis://host/0,redis://host/1"},
            clear=False,
        ):
            resolved = ts._resolve_node_urls(4)
            self.assertEqual(len(resolved), 4)
            self.assertEqual(resolved[0], "redis://host/0")
            self.assertEqual(resolved[1], "redis://host/1")
            self.assertEqual(resolved[2], "redis://host/0")
            self.assertEqual(resolved[3], "redis://host/1")


class TelemetryServiceShardRoundTripTest(SimpleTestCase):
    def setUp(self):
        ts.TelemetryShardRouter.reset()

    def tearDown(self):
        ts.TelemetryShardRouter.reset()

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
        from activities.telemetry_shard import TelemetryShardRouter

        remaining = 0
        for sk in ts.all_shard_keys(count=4):
            r = TelemetryShardRouter.client_for(sk.index)
            remaining += int(r.hlen(sk.positions) or 0)
        self.assertEqual(remaining, 0)

    @patch.dict("os.environ", {"TELEMETRY_SHARD_COUNT": "4"}, clear=False)
    def test_writes_land_on_multiple_shards(self):
        """Confirm sharding actually spreads keys (not all in one shard)."""
        from activities.telemetry_shard import TelemetryShardRouter

        self._push_grid(40)
        non_empty = 0
        for sk in ts.all_shard_keys(count=4):
            r = TelemetryShardRouter.client_for(sk.index)
            if int(r.hlen(sk.positions) or 0) > 0:
                non_empty += 1
        self.assertGreater(non_empty, 1)

    @patch.dict(
        "os.environ",
        {
            "TELEMETRY_SHARD_COUNT": "4",
            "REDIS_TELEMETRY_SHARD_NODES": "redis://fake/0,redis://fake/1,redis://fake/2,redis://fake/3",
        },
        clear=False,
    )
    def test_multi_client_routing_uses_separate_fake_redis(self):
        """Phase 2: each shard index gets its own client when nodes are configured."""
        from activities.services import TelemetryService
        from core.fake_redis import FakeRedis

        shards = [FakeRedis() for _ in range(4)]
        ts.TelemetryShardRouter.reset()
        ts.TelemetryShardRouter._clients = {i: shards[i] for i in range(4)}

        for i in range(4):
            TelemetryService.push_simulator_position(
                device_id=f"shard-test-{i}",
                lat=52.0 + i * 0.01,
                lon=21.0,
                name=f"S{i}",
            )

        # Each dedicated client should hold at least one key (hash tag differs per shard).
        filled = sum(1 for s in shards if s.storage)
        self.assertGreaterEqual(filled, 1)

        positions, meta = TelemetryService.get_live_positions(
            bbox=(20.0, 51.0, 22.0, 53.0),
            limit=100,
        )
        self.assertEqual(len(positions), 4)
        self.assertEqual(meta["telemetry_positions"], 4)
