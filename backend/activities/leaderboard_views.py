"""
Leaderboard API ViewSet — SPORT Platform
==========================================
Milestone 2: /api/activities/leaderboard/<city_id>/

Serves city leaderboard data from Redis (sub-5ms response).
Falls back to DB recalculation if Redis is empty.
"""

from __future__ import annotations

import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from activities.leaderboards import LeaderboardService

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def city_leaderboard(request: Request, city_id: str) -> Response:
    """
    GET /api/activities/leaderboard/<city_id>/

    Returns top 50 users for a city leaderboard, served from Redis.
    If Redis is empty, triggers async DB recalculation and returns 202.

    Query params:
        limit (int): Max results. Default 50, max 200.
        scope (str): 'city', 'event', 'club'. Default 'city'.

    Response:
        200: { city_id, scope, updated_at, count, leaderboard: [...] }
        202: { status: "recalculating" } — Redis empty, bg task queued
    """
    limit = min(int(request.query_params.get("limit", 50)), 200)
    scope = request.query_params.get("scope", "city")

    top = LeaderboardService.get_top_users(city_id, limit=limit, scope=scope)

    if not top:
        # Redis empty — queue background recalculation and reset_leaderboard_state
        from activities.tasks import recalculate_city_leaderboard

        recalculate_city_leaderboard.delay(city_id)
        return Response(
            {
                "status": "recalculating",
                "message": "Leaderboard is being calculated. Retry in 10 seconds.",
            },
            status=202,
        )

    last_updated = LeaderboardService.get_last_recalculated(city_id, scope=scope)

    # Contract Enrichment: Add usernames to the leaderboard entries
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user_ids = [e["user_id"] for e in top]
    users_map = {str(u.id): u.username for u in User.objects.filter(id__in=user_ids)}

    for entry in top:
        entry["username"] = users_map.get(str(entry["user_id"]), "Unknown Pilot")

    return Response(
        {
            "city_id": city_id,
            "scope": scope,
            "updated_at": last_updated,
            "count": len(top),
            "leaderboard": top,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_rank(request: Request, city_id: str) -> Response:
    """
    GET /api/activities/leaderboard/<city_id>/me/

    Returns the current user's rank and score in a city leaderboard.
    """
    scope = request.query_params.get("scope", "city")
    user_id = request.user.id

    rank = LeaderboardService.get_user_rank(city_id, user_id, scope=scope)
    score = LeaderboardService.get_user_score(city_id, user_id, scope=scope)

    return Response(
        {
            "city_id": city_id,
            "user_id": user_id,
            "rank": rank,
            "score_km": score,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def department_leaderboard(request: Request, department_id: int) -> Response:
    """
    GET /api/activities/leaderboard/department/<department_id>/

    Returns top 50 users in a specific department, ranked by verified distance.
    """
    from django.shortcuts import get_object_or_404
    from django.db.models import Sum
    from activities.models import Activity
    from users.departments import Department

    department = get_object_or_404(Department, id=department_id)

    # Check tenant access
    if request.user.role != "GLOBAL_OWNER" and department.tenant_id != request.user.tenant_id:
        return Response({"error": "Access denied"}, status=403)

    user_ids = department.members.values_list("id", flat=True)
    qs = (
        Activity.objects.filter(
            user_id__in=user_ids,
            is_verified=True,
        )
        .values("user__username")
        .annotate(total_km=Sum("distance"))
        .order_by("-total_km")[:50]
    )

    return Response(
        [
            {
                "username": r["user__username"],
                "total_km": round((r["total_km"] or 0) / 1000.0, 3),
            }
            for r in qs
        ]
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def leaderboard_list(request: Request) -> Response:
    """
    GET /api/activities/leaderboard/

    Returns available leaderboard types.
    """
    return Response({"leaderboards": ["city", "department", "event"]})


# ---------------------------------------------------------------------------
# Admin Management Endpoints
# ---------------------------------------------------------------------------

from users.permissions import IsAdminOrModerator

IsAdminRole = IsAdminOrModerator


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminRole])
def admin_recalculate_leaderboards(request: Request) -> Response:
    """
    POST /api/activities/leaderboard/admin/recalculate/

    Force recalculation of all city leaderboards by dispatching
    background Celery tasks for each active tenant.
    """
    from activities.tasks import recalculate_city_leaderboard
    from users.models import Tenant

    cities = list(Tenant.objects.filter(is_active=True).values_list("id", flat=True))
    # Explicitly reset_leaderboard_state for each city to avoid frontend race conditions
    for city_id in cities:
        recalculate_city_leaderboard.delay(str(city_id))

    logger.info(
        "admin_recalculate_leaderboards: queued %d cities",
        len(cities),
        extra={"user_id": request.user.id, "count": len(cities)},
    )

    return Response({"status": "recalculating", "cities": len(cities)})


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminRole])
def admin_leaderboard_list(request: Request) -> Response:
    """
    GET /api/activities/leaderboard/admin/list/

    Returns all available city leaderboards with metadata:
    city_id, city_name, total_participants, last_updated.
    """
    leaderboards = LeaderboardService.get_all_leaderboards(scope="city")
    return Response(leaderboards)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminRole])
def admin_clear_leaderboard(request: Request, city_id: str) -> Response:
    """
    DELETE /api/activities/leaderboard/admin/<city_id>/

    Clears the Redis cache for a specific city leaderboard.
    """
    LeaderboardService.clear_leaderboard(city_id, scope="city")

    logger.info(
        "admin_clear_leaderboard: cleared city_id=%s",
        city_id,
        extra={"user_id": request.user.id, "city_id": city_id},
    )

    return Response({"status": "cleared", "city_id": city_id})
