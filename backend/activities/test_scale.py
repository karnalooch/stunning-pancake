"""Tests for 300k-scale safeguards."""
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from activities.scale_config import MAX_CONCURRENT_RIDERS, MAX_BATCH_USERS
from activities.scale_preflight import analyze_scale
from activities.services import TelemetryService


class ScaleConfigTest(SimpleTestCase):
    def test_limits_sane(self):
        self.assertGreaterEqual(MAX_BATCH_USERS, 300_000)
        self.assertLessEqual(MAX_CONCURRENT_RIDERS, 10_000)


class ScalePreflightTest(SimpleTestCase):
    @patch('activities.scale_preflight._telemetry_active_count', return_value=0)
    @patch('activities.scale_preflight.sim.get_live_state', return_value={'running': False})
    @patch('activities.scale_preflight.get_user_model')
    def test_300k_forces_skip_activities(self, mock_user_model, *_rest):
        mock_user_model.objects.filter.return_value.count.return_value = 0
        report = analyze_scale(300_000, active_ratio=0.3, skip_activities=False)
        self.assertTrue(report['force_skip_activities'])
        self.assertTrue(report['effective_skip_activities'])
        self.assertEqual(report['estimated_concurrent_riders'], MAX_CONCURRENT_RIDERS)


class TelemetryServiceScaleTest(SimpleTestCase):
    def test_bbox_radius_positive(self):
        km = TelemetryService._bbox_radius_km(19.0, 52.0, 19.5, 52.5)
        self.assertGreater(km, 0)

    @patch('core.redis_cluster.get_redis')
    def test_get_live_positions_uses_geo(self, mock_get_redis):
        r = MagicMock()
        mock_get_redis.return_value = r
        r.hlen.return_value = 2
        r.georadius.return_value = [b'1', b'2']
        r.hmget.return_value = [
            b'{"deviceId":"1","latitude":52.2,"longitude":19.1}',
            b'{"deviceId":"2","latitude":52.21,"longitude":19.11}',
        ]

        with patch('activities.services.requests.get') as mock_req:
            mock_req.side_effect = Exception('no traccar')
            positions, meta = TelemetryService.get_live_positions(
                bbox=(19.0, 52.0, 19.5, 52.5),
                limit=10,
            )

        self.assertEqual(len(positions), 2)
        r.georadius.assert_called_once()
        r.hgetall.assert_not_called()
        self.assertIn('returned', meta)
