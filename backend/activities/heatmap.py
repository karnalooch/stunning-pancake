"""
Heatmap API — SPORT Platform (Milestone 5)
============================================
Constitution §25.2: City Analytics Layer

Provides GeoJSON heatmap data for Admin Dashboard and Smart City portals.

Heatmaps are built from verified activity GPS tracks using a
spatial binning approach (H3-compatible grid without external deps):

  1. Load verified activity LineStrings for the requested bbox.
  2. Sample coordinates at configurable resolution.
  3. Bin points into a grid and return as GeoJSON FeatureCollection
     with 'weight' property (normalised 0–1) per cell.

Endpoints (wired in core/urls.py):
    GET /api/heatmap/?bbox=lon_min,lat_min,lon_max,lat_max&type=RUN&zoom=12
"""
from __future__ import annotations

import logging
import math
from collections import defaultdict

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

logger = logging.getLogger(__name__)

# Grid cell size in degrees (approx 200m at equator)
DEFAULT_CELL_DEG = 0.002


def _cell_key(lat: float, lon: float, cell_size: float) -> tuple[int, int]:
    """Snaps a coordinate to the nearest grid cell."""
    return (int(lat / cell_size), int(lon / cell_size))


def _cell_to_centroid(row: int, col: int, cell_size: float) -> tuple[float, float]:
    """Returns (lat, lon) centroid of a grid cell."""
    return (row * cell_size + cell_size / 2, col * cell_size + cell_size / 2)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def heatmap_view(request: Request) -> Response:
    """
    Returns a GeoJSON FeatureCollection of heatmap cells.

    Query params:
        bbox     — 'lon_min,lat_min,lon_max,lat_max' (required)
        type     — Activity type filter: RUN|BIKE|WALK (default: all)
        zoom     — Map zoom level hint (influences cell_size, 1–18)
        tenant   — Tenant ID filter (default: all tenants)
    """
    from activities.models import Activity
    from django.contrib.gis.geos import Polygon

    bbox_raw = request.query_params.get("bbox", "")
    activity_type = request.query_params.get("type", "")
    zoom = int(request.query_params.get("zoom", 12))
    tenant_id = request.query_params.get("tenant", "")

    if not bbox_raw:
        return Response({"error": "bbox parameter required. Format: lon_min,lat_min,lon_max,lat_max."}, status=400)

    try:
        lon_min, lat_min, lon_max, lat_max = map(float, bbox_raw.split(","))
    except ValueError:
        return Response({"error": "Invalid bbox format."}, status=400)

    # Cell size adapts to zoom: zoom 10 → 0.005°, zoom 14 → 0.0005°
    cell_size = max(0.0001, DEFAULT_CELL_DEG / (2 ** max(0, zoom - 12)))

    bbox_poly = Polygon.from_bbox((lon_min, lat_min, lon_max, lat_max))
    bbox_poly.srid = 4326

    qs = Activity.objects.filter(
        is_verified=True,
        route_path__isnull=False,
        route_path__bboverlaps=bbox_poly,
    )
    if activity_type:
        qs = qs.filter(type=activity_type.upper())
    if tenant_id:
        qs = qs.filter(user__tenant_id=tenant_id)

    # Limit sample to avoid excessive load
    qs = qs.only("route_path")[:500]

    grid: dict[tuple[int, int], int] = defaultdict(int)

    for activity in qs:
        if not activity.route_path:
            continue
        coords = activity.route_path.coords
        # Sample every 5th point for performance
        for coord in coords[::5]:
            lon, lat = coord[0], coord[1]
            if lon_min <= lon <= lon_max and lat_min <= lat <= lat_max:
                key = _cell_key(lat, lon, cell_size)
                grid[key] += 1

    if not grid:
        return Response({"type": "FeatureCollection", "features": []})

    max_count = max(grid.values())

    features = []
    for (row, col), count in grid.items():
        lat_c, lon_c = _cell_to_centroid(row, col, cell_size)
        weight = round(count / max_count, 4)
        half = cell_size / 2
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [lon_c - half, lat_c - half],
                    [lon_c + half, lat_c - half],
                    [lon_c + half, lat_c + half],
                    [lon_c - half, lat_c + half],
                    [lon_c - half, lat_c - half],
                ]],
            },
            "properties": {
                "weight": weight,
                "count": count,
                "activityType": activity_type or "ALL",
            },
        })

    logger.info(
        "heatmap.generated cells=%d bbox=%s type=%s zoom=%d",
        len(features), bbox_raw, activity_type, zoom,
    )

    return Response({
        "type": "FeatureCollection",
        "features": features,
        "meta": {
            "totalCells": len(features),
            "maxCount": max_count,
            "cellSizeDeg": cell_size,
        },
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_summary_view(request: Request) -> Response:
    """
    Returns premium analytics for the authenticated user.

    Includes:
        - trend_analysis: weekly km trend with slope and R²
        - race_predictions: Riegel-based finish time estimates
        - training_load: ACWR injury risk score
    """
    from datetime import date, timedelta
    from django.db.models import Sum
    from activities.models import Activity
    from activities.analytics import trend_analysis, predict_race_time, training_load

    user = request.user
    today = date.today()

    # Build weekly loads for last 12 weeks
    weekly_loads = []
    for week_offset in range(11, -1, -1):
        week_start = today - timedelta(weeks=week_offset + 1)
        week_end = today - timedelta(weeks=week_offset)
        km_sum = Activity.objects.filter(
            user=user,
            is_verified=True,
            start_time__date__gte=week_start,
            start_time__date__lt=week_end,
        ).aggregate(total=Sum("distance"))["total"] or 0
        weekly_loads.append({"week_start": week_start.isoformat(), "km": km_sum / 1000.0})

    trend = trend_analysis(weekly_loads)

    # Build daily km for last 28 days (for ACWR)
    daily_km: dict[date, float] = {}
    for i in range(28):
        day = today - timedelta(days=i)
        km = Activity.objects.filter(
            user=user,
            is_verified=True,
            start_time__date=day,
        ).aggregate(total=Sum("distance"))["total"] or 0
        daily_km[day] = km / 1000.0

    acwr = training_load(daily_km)

    # Best effort for race prediction: longest verified activity
    best = Activity.objects.filter(
        user=user, is_verified=True, type="RUN",
    ).order_by("-distance").first()

    race_preds = None
    if best and best.distance > 0 and best.duration:
        ref_km = best.distance / 1000.0
        ref_s = best.duration.total_seconds()
        race_preds = {
            "5km":    predict_race_time(ref_km, ref_s, 5.0, "RUN"),
            "10km":   predict_race_time(ref_km, ref_s, 10.0, "RUN"),
            "half_marathon": predict_race_time(ref_km, ref_s, 21.0975, "RUN"),
            "marathon": predict_race_time(ref_km, ref_s, 42.195, "RUN"),
        }

    return Response({
        "trend": trend,
        "training_load": acwr,
        "race_predictions": race_preds,
        "weekly_loads": weekly_loads,
    })
