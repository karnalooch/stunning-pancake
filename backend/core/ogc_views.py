"""
OGC API — Moving Features (Milestone 4)
=========================================
Standardized telemetry export for Smart City partners.

Implements a subset of the OGC API — Moving Features standard:
https://ogcapi.ogc.org/movingfeatures/

Endpoints:
    GET /api/ogc/collections/                → Feature collections (events/activities)
    GET /api/ogc/collections/{id}/items/     → Paginated moving features
    GET /api/ogc/collections/{id}/items/{fid}/ → Single feature trajectory
"""

from __future__ import annotations

import logging
from datetime import datetime

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

logger = logging.getLogger(__name__)

# OGC conformance URIs
OGC_CONFORMANCE = [
    "http://www.opengis.net/spec/ogcapi-movingfeatures-1/1.0/conf/core",
    "http://www.opengis.net/spec/ogcapi-common-1/1.0/conf/core",
    "http://www.opengis.net/spec/ogcapi-common-2/0.0/conf/collections",
]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ogc_conformance(request: Request) -> Response:
    """OGC API — Moving Features: Conformance declaration."""
    return Response({"conformsTo": OGC_CONFORMANCE})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ogc_collections(request: Request) -> Response:
    """
    Lists available Moving Feature collections.
    Smart City partners use this to discover what data is available.
    """
    from events.models import Event

    events = Event.objects.filter(is_active=True).values("id", "title", "start_date", "end_date")
    collections = [
        {
            "id": f"event-{e['id']}",
            "title": e["title"],
            "description": f"Verified activity tracks for event: {e['title']}",
            "extent": {
                "temporal": {
                    "interval": [
                        [
                            e["start_date"].isoformat() if e["start_date"] else None,
                            e["end_date"].isoformat() if e["end_date"] else None,
                        ]
                    ]
                }
            },
            "links": [
                {
                    "href": request.build_absolute_uri(
                        f"/api/ogc/collections/event-{e['id']}/items/"
                    ),
                    "rel": "items",
                    "type": "application/geo+json",
                }
            ],
        }
        for e in events
    ]

    return Response(
        {
            "collections": collections,
            "links": [{"href": request.build_absolute_uri("/api/ogc/collections/"), "rel": "self"}],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ogc_collection_items(request: Request, collection_id: str) -> Response:
    """
    Returns paginated Moving Features (activity trajectories) for a collection.

    Query params:
        limit  — Max items per page (default: 20, max: 100)
        offset — Pagination offset

    Format: OGC GeoJSON MF-JSON (simplified)
    """
    from activities.models import Activity
    from events.models import Event

    limit = min(int(request.query_params.get("limit", 20)), 100)
    offset = int(request.query_params.get("offset", 0))

    # Parse collection_id → event_id
    try:
        event_id = int(collection_id.replace("event-", ""))
        event = Event.objects.get(pk=event_id)
    except (ValueError, Event.DoesNotExist):
        return Response({"error": "Collection not found."}, status=404)

    activities = Activity.objects.filter(
        is_verified=True,
        start_time__gte=event.start_date,
        route_path__isnull=False,
    ).select_related("user")[offset : offset + limit]

    features = []
    for act in activities:
        if not act.route_path:
            continue
        coords = list(act.route_path.coords)
        features.append(
            {
                "type": "Feature",
                "id": str(act.pk),
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords,
                },
                "properties": {
                    "datetime": act.start_time.isoformat(),
                    "activityType": act.type,
                    "distanceM": act.distance,
                    "isVerified": act.is_verified,
                },
                "time": {
                    "interval": [
                        act.start_time.isoformat(),
                        act.end_time.isoformat() if act.end_time else None,
                    ]
                },
            }
        )

    return Response(
        {
            "type": "FeatureCollection",
            "features": features,
            "numberReturned": len(features),
            "links": [
                {
                    "href": request.build_absolute_uri(),
                    "rel": "self",
                    "type": "application/geo+json",
                }
            ],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ogc_single_item(request: Request, collection_id: str, feature_id: str) -> Response:
    """
    Returns a single Moving Feature (full trajectory for one activity).

    Args:
        collection_id: e.g. 'event-42'
        feature_id: Activity primary key as string.
    """
    from activities.models import Activity

    try:
        act = Activity.objects.select_related("user").get(pk=int(feature_id), is_verified=True)
    except (ValueError, Activity.DoesNotExist):
        return Response({"error": "Feature not found."}, status=404)

    if not act.route_path:
        return Response({"error": "No trajectory available."}, status=404)

    coords = list(act.route_path.coords)
    timestamps = []
    if act.start_time and act.end_time:
        total_s = (act.end_time - act.start_time).total_seconds()
        n = len(coords)
        timestamps = [
            (act.start_time + timezone.timedelta(seconds=(total_s / max(n - 1, 1)) * i)).isoformat()
            for i in range(n)
        ]

    return Response(
        {
            "type": "Feature",
            "id": str(act.pk),
            "geometry": {
                "type": "LineString",
                "coordinates": coords,
            },
            "properties": {
                "activityType": act.type,
                "distanceM": act.distance,
                "timestamps": timestamps,
            },
            "time": {
                "interval": [
                    act.start_time.isoformat() if act.start_time else None,
                    act.end_time.isoformat() if act.end_time else None,
                ]
            },
        }
    )
