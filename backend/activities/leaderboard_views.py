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
        # Redis empty — queue background recalculation
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

    rank  = LeaderboardService.get_user_rank(city_id, user_id, scope=scope)
    score = LeaderboardService.get_user_score(city_id, user_id, scope=scope)

    return Response(
        {
            "city_id":  city_id,
            "user_id":  user_id,
            "rank":     rank,
            "score_km": score,
        }
    )
