"""Tests for route_sync helpers and sync_path idempotency."""

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from activities.models import Activity
from activities.route_sync import merge_linestrings, path_hash_for_coords


User = get_user_model()


class RouteSyncHelpersTest(TestCase):
    def test_merge_linestrings_skips_duplicate_joint(self):
        existing = LineString([(21.0, 52.0), (21.01, 52.01)], srid=4326)
        incoming = LineString([(21.01, 52.01), (21.02, 52.02)], srid=4326)
        merged = merge_linestrings(existing, incoming)
        self.assertEqual(merged.num_coords, 3)


class SyncPathIdempotentTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="route_sync_user",
            email="rs@example.com",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.activity = Activity.objects.create(
            user=self.user,
            type="RUN",
            start_time=timezone.now(),
            route_path=LineString([(21.0, 52.0), (21.01, 52.01)], srid=4326),
        )

    def test_sync_path_same_hash_returns_deduped(self):
        coords = [[21.0, 52.0], [21.01, 52.01], [21.02, 52.02]]
        path_hash = path_hash_for_coords([(c[0], c[1]) for c in coords])
        url = f"/api/activities/sessions/{self.activity.id}/sync_path/"
        r1 = self.client.patch(url, {"route_path": coords, "path_hash": path_hash}, format="json")
        self.assertEqual(r1.status_code, 200)
        r2 = self.client.patch(url, {"route_path": coords, "path_hash": path_hash}, format="json")
        self.assertEqual(r2.status_code, 200)
        self.assertTrue(r2.data.get("deduped"))

    def test_finalize_is_idempotent(self):
        url = f"/api/activities/sessions/{self.activity.id}/finalize/"
        r1 = self.client.post(url, {"distance": 1200}, format="json")
        self.assertIn(r1.status_code, (200, 201))
        r2 = self.client.post(url, {"distance": 1200}, format="json")
        self.assertEqual(r2.status_code, 200)
        self.activity.refresh_from_db()
        self.assertIsNotNone(self.activity.end_time)
