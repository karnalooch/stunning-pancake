from django.test import SimpleTestCase

from activities.live_map_api import _live_coords, poll_after_ms_hint, stream_interval_ms
from activities.views import EventStreamRenderer, TelemetryLiveStreamView


class LiveMapCoordTest(SimpleTestCase):
    def test_live_coords_from_latitude_longitude(self):
        self.assertEqual(
            _live_coords({"latitude": 52.23, "longitude": 21.01}),
            (52.23, 21.01),
        )

    def test_live_coords_rejects_null_and_zero(self):
        self.assertIsNone(_live_coords({"latitude": None, "longitude": 21.0}))
        self.assertIsNone(_live_coords({"lat": 0.0, "lng": 0.0}))


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


class TelemetryLiveStreamNegotiationTest(SimpleTestCase):
    def test_event_stream_renderer_registered(self):
        media_types = {r.media_type for r in TelemetryLiveStreamView().get_renderers()}
        self.assertIn(EventStreamRenderer.media_type, media_types)
