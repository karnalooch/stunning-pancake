"""Canonical ride-route reconstruction from durably persisted telemetry.

P3 / ADR 015: ``Activity.route_path`` is derived data. A mobile ``sync_path``
request is useful for live/recovery UX, but it is not the durable source of
truth for a completed ride. Finalization rebuilds the route from ``gps_points``
after the mobile outbox has received durable telemetry ACKs.
"""

from __future__ import annotations

import logging

from django.contrib.gis.geos import LineString
from django.db import DatabaseError, connection
from rest_framework.exceptions import APIException

from .models import Activity
from .services import PrivacyService

logger = logging.getLogger(__name__)


class RouteReconciliationPending(APIException):
    """Recoverable 409 finalization barrier failure.

    The client must retain its pending-finalization state and retry later. The
    response contains only stable/non-sensitive reason codes; DB and coordinate
    details never leave the server.
    """

    status_code = 409
    default_code = "route_reconciliation_pending"

    def __init__(self, code: str, detail: str) -> None:
        self.reconciliation_code = code
        super().__init__(
            detail={
                "code": code,
                "detail": detail,
                "sync_pending": True,
            }
        )


def _pending(code: str, detail: str) -> RouteReconciliationPending:
    return RouteReconciliationPending(code, detail)


def _load_receipt_summary(activity: Activity) -> tuple[int, int, int, int]:
    """Return durable batch proof: batches, total points, dropped privacy, max seq."""

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*), COALESCE(SUM(point_count), 0),
                       COALESCE(SUM(dropped_privacy), 0), COALESCE(MAX(max_seq), 0)
                FROM telemetry_ingest_receipts
                WHERE activity_id = %s AND user_id = %s
                """,
                [activity.id, activity.user_id],
            )
            row = cursor.fetchone()
    except DatabaseError as exc:
        logger.warning(
            "route_reconciliation.receipts_unavailable activity_id=%s error_type=%s",
            activity.id,
            type(exc).__name__,
        )
        raise _pending(
            "telemetry_receipts_unavailable",
            "Durable telemetry receipts are not available for finalization yet.",
        ) from exc

    assert row is not None
    return int(row[0]), int(row[1]), int(row[2]), int(row[3])


def _load_durable_points(activity: Activity) -> list[tuple[int, float, float]]:
    """Load one owner's durable telemetry in deterministic sequence order."""

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT seq, lon, lat
                FROM gps_points
                WHERE activity_id = %s AND user_id = %s
                ORDER BY seq ASC NULLS LAST, time ASC
                """,
                [activity.id, activity.user_id],
            )
            rows = cursor.fetchall()
    except DatabaseError as exc:
        logger.warning(
            "route_reconciliation.source_unavailable activity_id=%s error_type=%s",
            activity.id,
            type(exc).__name__,
        )
        raise _pending(
            "telemetry_source_unavailable",
            "Durable telemetry is not available for route reconciliation yet.",
        ) from exc

    if not rows:
        raise _pending(
            "telemetry_not_ready",
            "No durable GPS points are available for this activity yet.",
        )

    points: list[tuple[int, float, float]] = []
    seen_seq: set[int] = set()
    for seq, lon, lat in rows:
        if seq is None:
            raise _pending(
                "sequence_missing",
                "Durable GPS sequence metadata is incomplete.",
            )
        seq_int = int(seq)
        if seq_int in seen_seq:
            raise _pending(
                "sequence_duplicate",
                "Durable GPS sequence metadata is inconsistent.",
            )
        seen_seq.add(seq_int)

        lon_float = float(lon)
        lat_float = float(lat)
        if not (-180.0 <= lon_float <= 180.0 and -90.0 <= lat_float <= 90.0):
            raise _pending(
                "coordinate_invalid",
                "Durable GPS coordinates are invalid.",
            )
        points.append((seq_int, lon_float, lat_float))

    if len(points) < 2:
        raise _pending(
            "telemetry_not_ready",
            "At least two durable GPS points are required before finalization.",
        )

    return points


def reconcile_activity_route(activity: Activity, *, expected_max_seq: int) -> LineString:
    """Build the privacy-safe canonical ``route_path`` for a completed ride.

    ``telemetry_ingest_receipts`` proves that every client sequence through
    ``expected_max_seq`` reached a durable ACK boundary, including points that
    were deliberately discarded by privacy filtering. ``gps_points`` contains
    only durable public telemetry used to build the canonical route.
    """

    batch_count, point_count, dropped_privacy, receipt_max_seq = _load_receipt_summary(activity)
    if batch_count <= 0:
        raise _pending("telemetry_not_ready", "No durable telemetry receipts exist yet.")
    if expected_max_seq <= 0:
        raise _pending("expected_sequence_missing", "Finalization sequence proof is missing.")
    if receipt_max_seq != expected_max_seq:
        raise _pending(
            "telemetry_incomplete",
            "Durable telemetry has not reached the expected final sequence yet.",
        )
    if point_count != expected_max_seq:
        raise _pending(
            "sequence_range_incomplete",
            "Durable telemetry receipts do not cover one complete activity sequence.",
        )

    points = _load_durable_points(activity)
    if len(points) + dropped_privacy != point_count:
        raise _pending(
            "persisted_point_count_mismatch",
            "Durable GPS rows do not match acknowledged telemetry receipts.",
        )

    raw_path = LineString([(lon, lat) for _, lon, lat in points], srid=4326)
    masked_path = PrivacyService.mask_track(activity.user, raw_path)
    if masked_path is None or masked_path.num_coords < 2:
        raise _pending(
            "privacy_masked_empty",
            "The privacy-safe route does not contain enough public points to finalize.",
        )
    return masked_path
