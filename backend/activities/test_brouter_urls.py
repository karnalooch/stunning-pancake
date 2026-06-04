"""BRouter multi-endpoint config (BROUTER_URLS)."""

import os
from unittest import TestCase
from unittest.mock import patch

from activities.services import BRouterService


class BRouterUrlsTests(TestCase):
    def setUp(self):
        BRouterService._base_urls_cache = None
        BRouterService._rr_index = 0

    def tearDown(self):
        BRouterService._base_urls_cache = None
        BRouterService._rr_index = 0

    def test_single_brouter_url(self):
        with patch.dict(
            os.environ,
            {"BROUTER_URL": "http://brouter:17777/brouter", "BROUTER_URLS": ""},
            clear=False,
        ):
            self.assertEqual(
                BRouterService.base_urls(),
                ("http://brouter:17777/brouter",),
            )

    def test_brouter_urls_list(self):
        with patch.dict(
            os.environ,
            {
                "BROUTER_URLS": "http://brouter:17777/brouter,http://brouter-2:17777/brouter",
                "BROUTER_URL": "http://ignored:1/brouter",
            },
            clear=False,
        ):
            self.assertEqual(
                BRouterService.base_urls(),
                (
                    "http://brouter:17777/brouter",
                    "http://brouter-2:17777/brouter",
                ),
            )

    def test_round_robin_rotates(self):
        with patch.dict(
            os.environ,
            {
                "BROUTER_URLS": "http://a/brouter,http://b/brouter",
            },
            clear=False,
        ):
            i0 = BRouterService._next_request_index(2)
            i1 = BRouterService._next_request_index(2)
            i2 = BRouterService._next_request_index(2)
            self.assertEqual((i0, i1, i2), (0, 1, 0))

    def test_url_for_attempt_failover_order(self):
        urls = ("http://a/brouter", "http://b/brouter")
        self.assertEqual(BRouterService._url_for_attempt(1, 0, urls), "http://b/brouter")
        self.assertEqual(BRouterService._url_for_attempt(1, 1, urls), "http://a/brouter")
