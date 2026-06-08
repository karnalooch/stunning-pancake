"""OSRM client + sim routing backend selection (mocked HTTP)."""

from unittest.mock import MagicMock, patch

import pytest

pytestmark = pytest.mark.simulator_light

from django.test import SimpleTestCase

from activities import sim_routing
from activities.osrm_service import OsrmService


class OsrmServiceTest(SimpleTestCase):
    def test_extract_coordinates_geojson(self):
        data = {
            "code": "Ok",
            "routes": [
                {
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[21.0, 52.0], [21.01, 52.01]],
                    }
                }
            ],
        }
        pts = OsrmService.extract_coordinates(data)
        self.assertEqual(pts, [(52.0, 21.0), (52.01, 21.01)])

    @patch("activities.osrm_service.OsrmService._http")
    def test_route_coordinates_ok(self, mock_http_fn):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = {
            "code": "Ok",
            "routes": [
                {
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[21.0, 52.0], [21.02, 52.02]],
                    },
                    "distance": 2500,
                }
            ],
        }
        mock_http_fn.return_value.get.return_value = resp
        out = OsrmService.route_coordinates("RUN", [[21.0, 52.0], [21.02, 52.02]])
        self.assertTrue(out["success"])
        self.assertEqual(len(out["coordinates"]), 2)


class SimRoutingBackendTest(SimpleTestCase):
    @patch.dict("os.environ", {"SCALE_SIM_ROUTING_BACKEND": "osrm"}, clear=False)
    def test_resolve_osrm(self):
        fn = sim_routing.resolve_road_route_fn()
        self.assertIs(fn, sim_routing._osrm_route_waypoints)

    @patch.dict("os.environ", {"SCALE_SIM_ROUTING_BACKEND": "template"}, clear=False)
    def test_resolve_template_none(self):
        self.assertIsNone(sim_routing.resolve_road_route_fn())

    @patch.dict("os.environ", {"SCALE_SIM_ROUTING_BACKEND": "auto"}, clear=False)
    @patch("activities.osrm_service.OsrmService.health_check", return_value=True)
    def test_resolve_auto_osrm(self, _health):
        fn = sim_routing.resolve_road_route_fn()
        self.assertIs(fn, sim_routing._osrm_route_waypoints)
