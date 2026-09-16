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


def reconcile_activity_route(activity: Activity) -> LineString:
    """Build the privacy-safe canonical ``route_path`` for a completed ride.

    Telemetry drops points inside privacy zones before they reach ``gps_points``.
    We additionally run the backend privacy masker because it can apply a wider
    effective radius (for example density protection). Its straight bridge
    across a removed section is the project's established policy for hiding the
    exact privacy-zone boundary.

    Sequence gaps are allowed: under the pilot ACK contract every acknowledged
    batch is complete, while intentional privacy drops are not stored as raw
    coordinates. Missing/duplicate sequence *metadata* is not allowed.
    """

    points = _load_durable_points(activity)
    raw_path = LineString([(lon, lat) for _, lon, lat in points], srid=4326)
    masked_path = PrivacyService.mask_track(activity.user, raw_path)
    if masked_path is None or masked_path.num_coords < 2:
        raise _pending(
            "privacy_masked_empty",
            "The privacy-safe route does not contain enough public points to finalize.",
        )
    return masked_path
