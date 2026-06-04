"""SLO throttle + Redis route template cache (unit, no Redis)."""

import pytest
from unittest.mock import patch

pytestmark = pytest.mark.simulator_light

from django.test import SimpleTestCase

from activities import sim_route_cache as rc
from activities import sim_slo as slo


class SimRouteCacheTest(SimpleTestCase):
    def test_template_key_stable_bucket(self):
        k1 = rc.template_cache_key(city_slug="warsaw", activity_type="RUN", distance_m=5100)
        k2 = rc.template_cache_key(city_slug="warsaw", activity_type="RUN", distance_m=5200)
        self.assertEqual(k1, k2)

    def test_apply_template_shifts_anchor(self):
        tpl = {
            "anchor_lat": 52.0,
            "anchor_lon": 21.0,
            "waypoints": [[52.0, 21.0], [52.01, 21.01]],
        }
        out = rc.apply_route_template(tpl, anchor_lat=52.1, anchor_lon=21.1)
        self.assertAlmostEqual(out[0][0], 52.1, places=5)
        self.assertAlmostEqual(out[0][1], 21.1, places=5)


class SimSloTest(SimpleTestCase):
    @patch.dict(
        "os.environ",
        {
            "SIM_SLO_AUTO_THROTTLE": "1",
            "SIM_SLO_WARMING_ABOVE": "100",
            "SIM_SLO_AFTER_TICKS": "3",
            "SIM_SLO_STARTS_CAP": "40",
        },
        clear=False,
    )
    def test_slo_engages_after_consecutive_warming_ticks(self):
        eff, ticks, engaged, cap = slo.evaluate_starts_slo(
            warming_count=150,
            consecutive_warming_ticks=2,
            base_max_starts=150,
        )
        self.assertTrue(engaged)
        self.assertEqual(eff, 40)
        self.assertEqual(ticks, 3)
        self.assertEqual(cap, 40)

    @patch.dict("os.environ", {"SIM_SLO_AUTO_THROTTLE": "0"}, clear=False)
    def test_slo_disabled_passes_through(self):
        eff, ticks, engaged, _ = slo.evaluate_starts_slo(
            warming_count=999,
            consecutive_warming_ticks=99,
            base_max_starts=150,
        )
        self.assertFalse(engaged)
        self.assertEqual(eff, 150)
        self.assertEqual(ticks, 0)
