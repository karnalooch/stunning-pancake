from django.test import SimpleTestCase
from unittest.mock import MagicMock

from activities.live_map_api import (
    LiveMapRequest,
    _live_coords,
    _pos_scope_fields,
    build_live_map_payload,
    live_map_etag,
    poll_after_ms_hint,
    stream_interval_ms,
)
from activities.live_map_rbac import position_matches_scope, resolve_live_map_scope
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


class LiveMapScopeFilterTest(SimpleTestCase):
    def test_position_matches_tenant(self):
        self.assertTrue(
            position_matches_scope("aaa", None, "aaa", None)
        )
        self.assertFalse(
            position_matches_scope("aaa", None, "bbb", None)
        )
        self.assertFalse(
            position_matches_scope("aaa", None, None, None)
        )

    def test_position_matches_department(self):
        self.assertTrue(position_matches_scope(None, 5, None, 5))
        self.assertFalse(position_matches_scope(None, 5, None, 3))
        self.assertFalse(position_matches_scope(None, 5, None, None))

    def test_position_matches_department_ids_set(self):
        allowed = frozenset({1, 2})
        self.assertTrue(
            position_matches_scope(None, None, None, 1, department_ids=allowed)
        )
        self.assertFalse(
            position_matches_scope(None, None, None, 9, department_ids=allowed)
        )

    def test_pos_scope_fields_aliases(self):
        self.assertEqual(
            _pos_scope_fields({"tenantId": "t1", "departmentId": 3}),
            ("t1", 3),
        )

    def test_tenant_admin_scope_forced_from_user(self):
        user = MagicMock(role="TENANT_ADMIN", tenant_id="tenant-a")
        scope = resolve_live_map_scope(user, {"tenant_id": "other-tenant"})
        self.assertEqual(scope.tenant_id, "tenant-a")

    def test_build_payload_meta_includes_tenant_filter(self):
        from unittest.mock import patch

        positions = [
            {
                "deviceId": "1",
                "lat": 52.23,
                "lng": 21.01,
                "tenantId": "tenant-a",
                "departmentId": 1,
                "type": "bike",
            },
            {
                "deviceId": "2",
                "lat": 52.24,
                "lng": 21.02,
                "tenantId": "tenant-b",
                "departmentId": 2,
                "type": "run",
            },
        ]
        req = LiveMapRequest(
            bbox_tuple=(21.0, 52.2, 21.1, 52.3),
            limit=100,
            zoom_param=13.0,
            detail="full",
            fetch_limit=100,
            skip_cache=True,
            activity_type=None,
            city_slug=None,
            tenant_id="tenant-a",
            department_id=None,
            department_ids=None,
        )
        with patch(
            "activities.services.TelemetryService.get_live_positions",
            return_value=(positions, {"capped": False, "redis_active": 2}),
        ):
            body = build_live_map_payload(req)
        self.assertEqual(len(body["positions"]), 1)
        self.assertEqual(body["positions"][0]["deviceId"], "1")
        self.assertEqual(body["meta"]["filters"]["tenant_id"], "tenant-a")
        self.assertEqual(body["meta"]["viewport_filtered_out"], 1)


class LiveMapCitySlugIngestTest(SimpleTestCase):
    def test_encode_entry_includes_city_slug(self):
        from activities.services import TelemetryService

        _id, payload, _lon, _lat = TelemetryService._encode_entry(
            {
                "deviceId": "42",
                "lat": 52.2297,
                "lng": 21.0122,
                "type": "bike",
            }
        )
        import json

        row = json.loads(payload)
        self.assertEqual(row.get("citySlug"), "warszawa")


class LiveMapCompactStandardTest(SimpleTestCase):
    def test_compact_standard_omits_speed_and_ride_state(self):
        from unittest.mock import patch

        positions = [
            {
                "deviceId": "1",
                "lat": 52.23,
                "lng": 21.01,
                "speed": 4.5,
                "course": 90.0,
                "type": "bike",
            },
        ]
        req = LiveMapRequest(
            bbox_tuple=(21.0, 52.2, 21.1, 52.3),
            limit=100,
            zoom_param=10.0,
            detail="standard",
            fetch_limit=100,
            skip_cache=True,
            activity_type=None,
            city_slug=None,
            compact=True,
        )
        with patch(
            "activities.services.TelemetryService.get_live_positions",
            return_value=(positions, {"capped": False, "redis_active": 1}),
        ), patch(
            "activities.simulator_state.get_live_rides",
            return_value={"1": {"state": "RIDING"}},
        ):
            body = build_live_map_payload(req)
        row = body["positions"][0]
        self.assertEqual(row["deviceId"], "1")
        self.assertNotIn("speed", row)
        self.assertNotIn("course", row)
        self.assertNotIn("ride_state", row)


class LiveMapEtagTest(SimpleTestCase):
    def test_live_map_etag_stable_for_identical_payload(self):
        body = {"positions": [{"deviceId": "1", "lat": 52.0, "lng": 21.0}], "meta": {"detail": "full"}}
        self.assertEqual(live_map_etag(body), live_map_etag(body))
        self.assertTrue(live_map_etag(body).startswith('W/"'))
