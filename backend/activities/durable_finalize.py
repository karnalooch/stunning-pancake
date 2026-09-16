"""Pilot-safe activity finalization guarded by durable telemetry evidence."""

from __future__ import annotations

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status, views
from rest_framework.response import Response

from .models import Activity
from .route_reconciliation import RouteReconciliationPending, reconcile_activity_route
from .serializers import ActivitySerializer


class DurableActivityFinalizeView(views.APIView):
    """Finalize only after the complete ACKed telemetry sequence is provable.

    ADR 015 treats finalization as a critical-data acknowledgement boundary.
    The mobile client sends the last sequence number it produced for the ride;
    the backend requires matching durable ingest receipts and reconstructs the
    canonical privacy-safe route from persisted ``gps_points`` before setting
    ``end_time``. A retryable 409 keeps the mobile pending-finalization record.
    """

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk: int):
        activity = get_object_or_404(
            Activity.objects.select_related("user"),
            pk=pk,
            user=request.user,
        )
        if activity.end_time:
            return Response(ActivitySerializer(activity).data, status=status.HTTP_200_OK)

        expected_raw = request.data.get("expected_max_seq")
        try:
            expected_max_seq = int(expected_raw)
        except (TypeError, ValueError):
            raise RouteReconciliationPending(
                "expected_sequence_missing",
                "Finalization requires the last produced GPS sequence.",
            )
        if expected_max_seq <= 0:
            raise RouteReconciliationPending(
                "expected_sequence_missing",
                "Finalization requires the last produced GPS sequence.",
            )

        canonical_route = reconcile_activity_route(
            activity,
            expected_max_seq=expected_max_seq,
        )

        end_raw = request.data.get("end_time")
        end_time = parse_datetime(end_raw) if end_raw else timezone.now()
        if end_time and timezone.is_naive(end_time):
            end_time = timezone.make_aware(end_time, timezone.get_current_timezone())
        resolved_end = end_time or timezone.now()

        distance_raw = request.data.get("distance")
        try:
            distance = float(distance_raw) if distance_raw is not None else None
        except (TypeError, ValueError):
            return Response(
                {"detail": "Invalid distance."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            locked = Activity.objects.select_for_update().get(pk=activity.pk, user=request.user)
            if locked.end_time:
                return Response(ActivitySerializer(locked).data, status=status.HTTP_200_OK)

            locked.route_path = canonical_route
            locked.end_time = resolved_end
            if distance is not None:
                locked.distance = distance
            if locked.start_time:
                locked.duration = locked.end_time - locked.start_time
            locked.save()

        payload = dict(ActivitySerializer(locked).data)
        payload["telemetry_reconciled"] = True
        payload["expected_max_seq"] = expected_max_seq
        return Response(payload, status=status.HTTP_200_OK)
