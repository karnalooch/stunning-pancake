from datetime import UTC, datetime
from unittest.mock import MagicMock

from django.test import SimpleTestCase

from activities.live_map_replay import (
    _interval_literal,
    parse_replay_query_params,
)


class LiveMapReplayParseTest(SimpleTestCase):
    def test_parse_replay_window(self):
        user = MagicMock(role="GLOBAL_OWNER", tenant_id=None)
        qp = {
            "from": "2026-06-04T10:00:00Z",
            "to": "2026-06-04T10:30:00Z",
            "step": "30s",
            "bbox": "21.0,52.2,21.1,52.3",
        }
        req = parse_replay_query_params(qp, user=user)
        self.assertIsNotNone(req)
        assert req is not None
        self.assertEqual(req.step_ms, 30000)
        self.assertEqual(req.time_from, datetime(2026, 6, 4, 10, 0, tzinfo=UTC))

    def test_parse_replay_invalid_window(self):
        req = parse_replay_query_params({"from": "bad", "to": "2026-06-04T10:00:00Z"})
        self.assertIsNone(req)

    def test_interval_literal(self):
        self.assertEqual(_interval_literal(5000), "5 seconds")
        self.assertEqual(_interval_literal(30000), "30 seconds")
        self.assertEqual(_interval_literal(60000), "60 seconds")
