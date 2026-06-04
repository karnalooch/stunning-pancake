from django.test import SimpleTestCase

from activities.live_map_api import poll_after_ms_hint, stream_interval_ms


class LiveMapApiTimingTest(SimpleTestCase):
    def test_stream_interval_street_zoom(self):
        self.assertEqual(stream_interval_ms(13.0, False), 350)
        self.assertEqual(stream_interval_ms(14.5, False), 200)

    def test_stream_interval_ingest_multiplier(self):
        ms = stream_interval_ms(13.0, True, 2.5)
        self.assertGreaterEqual(ms, 200)
        self.assertLessEqual(ms, 2000)

    def test_poll_shorter_at_zoom_12(self):
        self.assertEqual(poll_after_ms_hint(12.0, False), 950)
        self.assertEqual(poll_after_ms_hint(14.0, False), 800)
        self.assertGreater(poll_after_ms_hint(10.0, False), poll_after_ms_hint(12.0, False))
