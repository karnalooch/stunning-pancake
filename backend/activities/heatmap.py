"""
Heatmap API — SPORT Platform (Milestone 5)
============================================

Constitution §25.2: City Analytics Layer

BBox-limited, cached GeoJSON heatmaps — safe at 300k+ users / millions of
activities. All access is tenant-scoped: the tenant scope is never taken from
a client query parameter; it is derived from ``request.user`` for tenant roles
and from an explicit, validated tenant id only for ``GLOBAL_OWNER``.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
from collections import defaultdict

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

logger = logging.getLogger(__name__)

DEFAULT_CELL_DEG = 0.002
HEATMAP_CACHE_PREFIX = "{heatmap}:tile:"
HEATMAP_GLOBAL_SCOPE = "global"


def _user_tenant_id(user):
    return getattr(user, "tenant_id", None)


def _bbox_diagonal_km(lon_min: float, lat_min: float, lon_max: float, lat_max: float) -> float:
    lat_mid = (lat_min + lat_max) / 2.0
    dx = (lon_max - lon_min) * 111.0 * math.cos(math.radians(lat_mid))
    dy = (lat_max - lat_min) * 111.0
    return math.sqrt(dx * dx + dy * dy)


def _cache_key(bbox_raw: str, activity_type: str, zoom: int, scope: str) -> str:
    digest = hashlib.sha256(f"{bbox_raw}|{activity_type}|{zoom}|{scope}".encode()).hexdigest()[:24]
    return f"{HEATMAP_CACHE_PREFIX}{digest}"


def _get_cached(key: str) -> dict | None:
    try:
        from core.redis_cluster import get_redis

        raw = get_redis().get(key)
        if raw:
            return json.loads(raw.decode() if isinstance(raw, bytes) else raw)
    except Exception:
        pass
    return None


def _set_cached(key: str, payload: dict, ttl: int) -> None:
    try:
        from core.redis_cluster import get_redis

        get_redis().setex(key, ttl, json.dumps(payload))
    except Exception:
        pass


def _cell_key(lat: float, lon: float, cell_size: float) -> tuple[int, int]:
    return (int(lat / cell_size), int(lon / cell_size))


def _cell_to_centroid(row: int, col: int, cell_size: float) -> tuple[float, float]:
    return (row * cell_size + cell_size / 2, col * cell_size + cell_size / 2)


def _scoped_heatmap_activities(scope, *, activity_type=None):
    """Base queryset for heatmap features, tenant-scoped by the effective scope.

    The ``scope`` argument is the canonical effective scope produced by
    ``_resolve_heatmap_scope`` (either ``HEATMAP_GLOBAL_SCOPE`` or a tenant id).
    Filters operate on ``Activity.tenant_id`` — never on ``user__tenant_id``.
    """
    from activities.models import Activity

    qs = Activity.objects.filter(
        is_verified=True,
        route_path__isnull=False,
    )
    if activity_type:
        qs = qs.filter(type=activity_type.upper())
    if scope != HEATMAP_GLOBAL_SCOPE:
        qs = qs.filter(tenant_id=scope)
    return qs.only("route_path", "tenant_id", "type").order_by("-created_at")


def _resolve_heatmap_scope(request) -> tuple[str | None, Response | None]:
    """Return ``(scope, None)`` or ``(None, error_response)``.

    * ``GLOBAL_OWNER``: no param → ``HEATMAP_GLOBAL_SCOPE``; an existing tenant
      id → that tenant; an invalid/missing tenant id → 400 (no global fallback).
    * Tenant roles: scope is always ``request.user.tenant_id``; the
      ``?tenant=`` query parameter is ignored. A missing tenant, inactive
      tenant, or a tenant without ``has_heatmap_analytics`` yields 403.
    """
    from users.models import Tenant

    user = request.user
    role = getattr(user, "role", None)
    requested = (request.query_params.get("tenant") or "").strip()

    if role == "GLOBAL_OWNER":
        if not requested:
            return HEATMAP_GLOBAL_SCOPE, None
        try:
            tenant = Tenant.objects.filter(pk=requested).first()
        except (DjangoValidationError, ValueError, TypeError):
            tenant = None
        if tenant is None:
            return None, Response({"error": "Unknown tenant."}, status=400)
        return str(tenant.id), None

    tenant_id = _user_tenant_id(user)
    if not tenant_id:
        return None, Response({"error": "Tenant scope required."}, status=403)
    try:
        tenant = Tenant.objects.filter(pk=tenant_id).first()
    except (DjangoValidationError, ValueError, TypeError):
        tenant = None
    if tenant is None or not tenant.is_active or not tenant.has_heatmap_analytics:
        return None, Response({"error": "Heatmap analytics not available."}, status=403)
    return str(tenant.id), None


def _resolve_department_for_analytics(request):
    """Resolve the ``Department`` for ``?department=`` within the approved scope.

    * Without ``?department`` → ``Q(user=request.user)`` filter.
    * With ``?department``: tenant-bound users must reference an active
      department in their own tenant; ``GLOBAL_OWNER`` may reference any
      existing department. A tenant-bound user without a tenant is rejected
      with 403. A foreign / non-existent / inactive department returns 404.
    """
    from users.departments import Department

    user = request.user
    department_id = request.query_params.get("department")
    if not department_id:
        return None, None

    role = getattr(user, "role", None)
    if role != "GLOBAL_OWNER":
        tenant_id = _user_tenant_id(user)
        if not tenant_id:
            return None, Response({"error": "Tenant scope required."}, status=403)
        try:
            department = Department.objects.filter(
                pk=department_id, is_active=True, tenant_id=tenant_id
            ).first()
        except (DjangoValidationError, ValueError, TypeError):
            department = None
        if department is None:
            return None, Response({"error": "Department not found."}, status=404)
        return department, None

    try:
        department = Department.objects.filter(pk=department_id, is_active=True).first()
    except (DjangoValidationError, ValueError, TypeError):
        department = None
    if department is None:
        return None, Response({"error": "Department not found."}, status=404)
    return department, None


def _build_heatmap_features(
    lon_min: float,
    lat_min: float,
    lon_max: float,
    lat_max: float,
    activity_type: str,
    zoom: int,
    scope: str,
) -> dict:
    from django.contrib.gis.geos import Polygon

    from activities.scale_config import HEATMAP_MAX_ACTIVITIES_SAMPLE

    cell_size = max(0.0001, DEFAULT_CELL_DEG / (2 ** max(0, zoom - 12)))
    bbox_poly = Polygon.from_bbox((lon_min, lat_min, lon_max, lat_max))
    bbox_poly.srid = 4326

    qs = _scoped_heatmap_activities(scope, activity_type=activity_type).filter(
        route_path__bboverlaps=bbox_poly
    )
    max_sample = HEATMAP_MAX_ACTIVITIES_SAMPLE

    grid: dict[tuple[int, int], int] = defaultdict(int)
    seen = 0
    for activity in qs.iterator(chunk_size=200):
        if seen >= max_sample:
            break
        if not activity.route_path:
            continue
        seen += 1
        coords = activity.route_path.coords
        for coord in coords[::5]:
            lon, lat = coord[0], coord[1]
            if lon_min <= lon <= lon_max and lat_min <= lat <= lat_max:
                grid[_cell_key(lat, lon, cell_size)] += 1

    if not grid:
        return {
            "type": "FeatureCollection",
            "features": [],
            "meta": {
                "totalCells": 0,
                "maxCount": 0,
                "cellSizeDeg": cell_size,
                "sampled": seen,
                "scope": scope,
            },
        }

    max_count = max(grid.values())
    features = []
    for (row, col), count in grid.items():
        lat_c, lon_c = _cell_to_centroid(row, col, cell_size)
        weight = round(count / max_count, 4)
        half = cell_size / 2
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [lon_c - half, lat_c - half],
                            [lon_c + half, lat_c - half],
                            [lon_c + half, lat_c + half],
                            [lon_c - half, lat_c + half],
                            [lon_c - half, lat_c - half],
                        ]
                    ],
                },
                "properties": {
                    "weight": weight,
                    "count": count,
                    "activityType": activity_type or "ALL",
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {
            "totalCells": len(features),
            "maxCount": max_count,
            "cellSizeDeg": cell_size,
            "sampled": seen,
            "sampleCap": max_sample,
            "scope": scope,
        },
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def heatmap_view(request: Request) -> Response:
    from activities.scale_config import (
        HEATMAP_CACHE_TTL,
        HEATMAP_MAX_BBOX_KM,
        HEATMAP_MIN_ZOOM,
    )

    bbox_raw = request.query_params.get("bbox", "")
    activity_type = request.query_params.get("type", "")
    try:
        zoom = int(request.query_params.get("zoom", 12))
    except (TypeError, ValueError):
        zoom = 12

    if not bbox_raw:
        return Response(
            {"error": "bbox parameter required. Format: lon_min,lat_min,lon_max,lat_max."},
            status=400,
        )

    try:
        lon_min, lat_min, lon_max, lat_max = map(float, bbox_raw.split(","))
    except ValueError:
        return Response({"error": "Invalid bbox format."}, status=400)

    if zoom < HEATMAP_MIN_ZOOM:
        return Response(
            {
                "error": f"Zoom in further (min zoom {HEATMAP_MIN_ZOOM}) to load heatmap.",
                "min_zoom": HEATMAP_MIN_ZOOM,
            },
            status=400,
        )

    diagonal_km = _bbox_diagonal_km(lon_min, lat_min, lon_max, lat_max)
    if diagonal_km > HEATMAP_MAX_BBOX_KM:
        return Response(
            {
                "error": (
                    f"Viewport too large ({diagonal_km:.0f} km). "
                    f"Max {HEATMAP_MAX_BBOX_KM} km — zoom in on a city or region."
                ),
                "max_bbox_km": HEATMAP_MAX_BBOX_KM,
            },
            status=400,
        )

    scope, error = _resolve_heatmap_scope(request)
    if error is not None:
        return error

    cache_key = _cache_key(bbox_raw, activity_type, zoom, scope)
    if request.query_params.get("refresh") != "1":
        cached = _get_cached(cache_key)
        if cached:
            cached = dict(cached)
            cached.setdefault("meta", {})["cached"] = True
            return Response(cached)

    payload = _build_heatmap_features(
        lon_min,
        lat_min,
        lon_max,
        lat_max,
        activity_type,
        zoom,
        scope,
    )
    payload.setdefault("meta", {})["cached"] = False
    _set_cached(cache_key, payload, HEATMAP_CACHE_TTL)

    logger.info(
        "heatmap.generated cells=%d",
        len(payload.get("features", [])),
    )
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_summary_view(request: Request) -> Response:
    """
    Returns premium analytics for the authenticated user.
    """
    from datetime import date, timedelta

    from django.db.models import Q, Sum
    from django.db.models.functions import TruncDay, TruncWeek

    from activities.analytics import predict_race_time, training_load, trend_analysis
    from activities.models import Activity

    user = request.user
    department, error = _resolve_department_for_analytics(request)
    if error is not None:
        return error
    today = date.today()

    if department is None:
        activity_scope = Q(user=user)
    else:
        # Department membership is paired with the canonical ``Activity.tenant_id``
        # filter to defeat inconsistent historical relations across tenants.
        activity_scope = Q(
            user__departments__id=department.id,
            tenant_id=department.tenant_id,
        )

    weekly_qs = (
        Activity.objects.filter(
            activity_scope,
            is_verified=True,
            start_time__date__gte=today - timedelta(weeks=12),
        )
        .annotate(week=TruncWeek("start_time"))
        .values("week")
        .annotate(km=Sum("distance"))
        .order_by("week")
    )

    weekly_loads_map = {row["week"].date(): (row["km"] or 0) / 1000.0 for row in weekly_qs}
    weekly_loads = []
    for week_offset in range(11, -1, -1):
        week_start = today - timedelta(weeks=week_offset + 1)
        weekly_loads.append(
            {"week_start": week_start.isoformat(), "km": weekly_loads_map.get(week_start, 0.0)}
        )

    trend = trend_analysis(weekly_loads)

    daily_qs = (
        Activity.objects.filter(
            activity_scope,
            is_verified=True,
            start_time__date__gte=today - timedelta(days=28),
        )
        .annotate(day=TruncDay("start_time"))
        .values("day")
        .annotate(km=Sum("distance"))
        .order_by("day")
    )

    daily_km_map = {row["day"].date(): (row["km"] or 0) / 1000.0 for row in daily_qs}
    daily_km: dict[date, float] = {}
    for i in range(28):
        day = today - timedelta(days=i)
        daily_km[day] = daily_km_map.get(day, 0.0)

    acwr = training_load(daily_km)

    best = (
        Activity.objects.filter(
            activity_scope,
            is_verified=True,
            type="RUN",
        )
        .order_by("-distance")
        .first()
    )

    race_preds = None
    if best and best.distance > 0 and best.duration:
        ref_km = best.distance / 1000.0
        ref_s = best.duration.total_seconds()
        race_preds = {
            "5km": predict_race_time(ref_km, ref_s, 5.0, "RUN"),
            "10km": predict_race_time(ref_km, ref_s, 10.0, "RUN"),
            "half_marathon": predict_race_time(ref_km, ref_s, 21.0975, "RUN"),
            "marathon": predict_race_time(ref_km, ref_s, 42.195, "RUN"),
        }

    return Response(
        {
            "trend": trend,
            "training_load": acwr,
            "race_predictions": race_preds,
            "weekly_loads": weekly_loads,
        }
    )
