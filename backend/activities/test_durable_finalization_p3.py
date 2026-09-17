"""P3 durable telemetry reconciliation/finalization contract tests."""

from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from activities.models import Activity
from activities.route_reconciliation import (
    RouteReconciliationPending,
    _summarize_receipt_rows,
    reconcile_activity_route,
)

User = get_user_model()


class RouteReconciliationContractTest(TestCase):
    def setUp(self):
        self.activity = SimpleNamespace(id=17, user_id=9, user=SimpleNamespace(id=9))

    def test_receipt_ranges_prove_exact_sequence_including_privacy_drops(self):
        summary = _summarize_receipt_rows(
            [
                (2, 1, 2, "a" * 64),
                (2, 2, 4, "b" * 64),
            ]
        )

        self.assertEqual(summary, (2, 4, 3, 4))

    def test_receipt_ranges_reject_overlap_gap_even_when_count_equals_max_seq(self):
        # Aggregate-only validation would see 4 points and max_seq=4 and pass.
        # The actual ranges are [1,2], [2], [4]: seq=2 overlaps and seq=3 is absent.
        with self.assertRaises(RouteReconciliationPending) as ctx:
            _summarize_receipt_rows(
                [
                    (2, 0, 2, "a" * 64),
                    (1, 1, 2, "b" * 64),
                    (1, 1, 4, "c" * 64),
                ]
            )

        self.assertEqual(ctx.exception.reconciliation_code, "sequence_range_incomplete")

    def test_receipt_ranges_fail_closed_without_payload_fingerprint(self):
        with self.assertRaises(RouteReconciliationPending) as ctx:
            _summarize_receipt_rows([(1, 0, 1, None)])

        self.assertEqual(ctx.exception.reconciliation_code, "receipt_identity_unverifiable")

    @patch("activities.route_reconciliation.PrivacyService.mask_track")
    @patch("activities.route_reconciliation._load_durable_points")
    @patch("activities.route_reconciliation._load_receipt_summary")
    def test_rebuilds_route_when_receipts_cover_full_sequence(
        self,
        receipt_summary,
        durable_points,
        mask_track,
    ):
        receipt_summary.return_value = (2, 4, 1, 4)
        durable_points.return_value = [
            (1, 21.0, 52.0),
            (2, 21.01, 52.01),
            (4, 21.03, 52.03),
        ]
        mask_track.side_effect = lambda _user, path: path

        route = reconcile_activity_route(self.activity)

        self.assertIsNotNone(route)
        self.assertEqual(route.num_coords, 3)
        self.assertEqual(list(route.coords)[-1], (21.03, 52.03))

    @patch("activities.route_reconciliation._load_receipt_summary")
    def test_rejects_missing_sequence_range(self, receipt_summary):
        receipt_summary.return_value = (2, 3, 0, 4)

        with self.assertRaises(RouteReconciliationPending) as ctx:
            reconcile_activity_route(self.activity)

        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.reconciliation_code, "sequence_range_incomplete")

    @patch("activities.route_reconciliation._load_durable_points")
    @patch("activities.route_reconciliation._load_receipt_summary")
    def test_rejects_receipt_to_row_count_mismatch(self, receipt_summary, durable_points):
        receipt_summary.return_value = (1, 4, 1, 4)
        durable_points.return_value = [(1, 21.0, 52.0), (2, 21.01, 52.01)]

        with self.assertRaises(RouteReconciliationPending) as ctx:
            reconcile_activity_route(self.activity)

        self.assertEqual(ctx.exception.reconciliation_code, "persisted_point_count_mismatch")

    @patch("activities.route_reconciliation._load_durable_points")
    @patch("activities.route_reconciliation._load_receipt_summary")
    def test_privacy_only_ride_returns_no_route_without_fabrication(
        self,
        receipt_summary,
        durable_points,
    ):
        receipt_summary.return_value = (1, 3, 3, 3)
        durable_points.return_value = []

        self.assertIsNone(reconcile_activity_route(self.activity))


class DurableFinalizeEndpointTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="durable-finalize-user",
            email="durable@example.com",
            password="testpass123",
        )
        self.other = User.objects.create_user(
            username="durable-finalize-other",
            email="durable-other@example.com",
            password="testpass123",
        )
        self.activity = Activity.objects.create(
            user=self.user,
            type="BIKE",
            start_time=timezone.now(),
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = f"/api/activities/sessions/{self.activity.id}/finalize-durable/"

    @patch("activities.durable_finalize.reconcile_activity_route")
    def test_finalizes_only_after_reconciliation_and_is_idempotent(self, reconcile):
        reconcile.return_value = LineString(
            [(21.0, 52.0), (21.01, 52.01), (21.02, 52.02)],
            srid=4326,
        )

        first = self.client.post(self.url, {"distance": 1200}, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.data["telemetry_reconciled"])

        self.activity.refresh_from_db()
        self.assertIsNotNone(self.activity.end_time)
        self.assertEqual(self.activity.route_path.num_coords, 3)

        second = self.client.post(self.url, {"distance": 1200}, format="json")
        self.assertEqual(second.status_code, 200)
        self.assertEqual(reconcile.call_count, 1)

    @patch("activities.durable_finalize.reconcile_activity_route")
    def test_other_user_cannot_finalize_activity(self, reconcile):
        self.client.force_authenticate(self.other)

        response = self.client.post(self.url, {"distance": 1200}, format="json")

        self.assertEqual(response.status_code, 404)
        reconcile.assert_not_called()
