from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from activities.live_map_alerts import _detect_events
from activities.live_map_audit import record_live_map_view, should_skip_audit


class LiveMapAuditTest(SimpleTestCase):
    @patch("core.redis_cluster.get_redis")
    def test_rate_limit_dedupe(self, mock_get_redis):
        r = MagicMock()
        r.set.return_value = False
        mock_get_redis.return_value = r
        self.assertTrue(should_skip_audit(1, "sess", "bbox1"))

    @patch("activities.live_map_audit.should_skip_audit", return_value=False)
    @patch("users.models.AuditLog.objects.create")
    def test_record_creates_audit_row(self, mock_create, _skip):
        request = MagicMock()
        request.user = MagicMock(is_authenticated=True, id=5, tenant_id="t-1")
        request.META = {"REMOTE_ADDR": "127.0.0.1"}
        result = record_live_map_view(
            request,
            {
                "session_id": "abc",
                "bbox_hash": "hash1",
                "zoom": 12,
                "positions_returned": 10,
            },
        )
        self.assertTrue(result["recorded"])
        mock_create.assert_called_once()
        call_kw = mock_create.call_args.kwargs
        self.assertEqual(call_kw["action"], "LIVE_MAP_VIEW")
        self.assertEqual(call_kw["details"]["zoom"], 12)


class LiveMapAlertsDetectTest(SimpleTestCase):
    def test_viewport_capped_event(self):
        events = _detect_events(
            {"capped": True, "viewport_total_estimate": 100, "positions_returned": 20}
        )
        self.assertIn("viewport_capped", events)

    def test_zero_positions_anomaly(self):
        events = _detect_events({"ride_on_map": 5, "positions_returned": 0})
        self.assertIn("zero_positions_anomaly", events)
