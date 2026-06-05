from unittest.mock import MagicMock

from django.test import SimpleTestCase

from activities.live_map_aggregate import (
    _filter_positions,
    _hexbin_features,
    parse_aggregate_query_params,
)
from activities.live_map_aggregate import AggregateRequest


class LiveMapAggregateParseTest(SimpleTestCase):
    def test_parse_aggregate_params(self):
        user = MagicMock(role="GLOBAL_OWNER", tenant_id=None)
        qp = {"bbox": "21.0,52.2,21.1,52.3", "mode": "hexbin", "resolution": "0.01"}
        req = parse_aggregate_query_params(qp, user=user)
        self.assertIsNotNone(req)
        assert req is not None
        self.assertEqual(req.mode, "hexbin")

    def test_parse_requires_bbox(self):
        self.assertIsNone(parse_aggregate_query_params({}))


class LiveMapHexbinTest(SimpleTestCase):
    def test_hexbin_builds_cells(self):
        req = AggregateRequest(
            bbox_tuple=(21.0, 52.2, 21.1, 52.3),
            mode="hexbin",
            resolution=0.01,
            tenant_id=None,
            department_id=None,
            department_ids=None,
        )
        positions = [{"lat": 52.23, "lng": 21.01}, {"lat": 52.231, "lng": 21.011}]
        body = _hexbin_features(req, positions)
        self.assertGreaterEqual(body["meta"]["cells"], 1)

    def test_filter_positions_in_bbox(self):
        req = AggregateRequest(
            bbox_tuple=(21.0, 52.2, 21.1, 52.3),
            mode="hexbin",
            resolution=0.01,
            tenant_id=None,
            department_id=None,
            department_ids=None,
        )
        raw = [
            {"lat": 52.23, "lng": 21.01},
            {"lat": 50.0, "lng": 19.0},
        ]
        filtered = _filter_positions(req, raw)
        self.assertEqual(len(filtered), 1)
