"""
Leaderboard Service v2 — SPORT Platform
=========================================
Constitution §21.2: Redis Sorted Set Leaderboards
Milestone 2: Async batch recalculation pipeline

Enhancements over v1:
- Redis pipeline for O(1) batch ZADD instead of per-activity ZINCRBY
- Cache TTL per leaderboard key (30s via EXPIRE)
- reset() method for cleaning expired event boards
- Celery task integration point: recalculate_city_leaderboard()
- Exposed via DRF endpoint /api/activities/leaderboard/<city_id>/

Key schema:
    leaderboard:<scope>:<id>    → Redis Sorted Set (score = total km)
    leaderboard:<scope>:<id>:ts → Redis String (last recalculation timestamp)
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

from core.redis_cluster import get_redis, get_pipeline

logger = logging.getLogger(__name__)

_CACHE_TTL_S = int(os.getenv("LEADERBOARD_CACHE_TTL", "30"))   # seconds


class LeaderboardService:
    """
    Real-time leaderboard engine using Redis Sorted Sets.

    Supports three scopes:
    - city  — city/tenant aggregate (global city rankings)
    - event — per-event score during an event window
    - club  — club challenge tracking

    All keys follow: leaderboard:<scope>:<id>
    """

    _redis = None

    @classmethod
    def _get_redis(cls):
        if cls._redis is None:
            cls._redis = get_redis()
        return cls._redis

    @classmethod
    def _key(cls, scope: str, entity_id: str | int) -> str:
        return f"leaderboard:{scope}:{entity_id}"

    # ------------------------------------------------------------------
    # Write (single — still used for real-time updates)
    # ------------------------------------------------------------------

    @classmethod
    def update_score(
        cls,
        user_id: int,
        entity_id: str | int,
        score_delta: float,
        scope: str = "city",
    ) -> None:
        """
        Atomically increments a user's score in a leaderboard.

        Args:
            user_id: SPORT user ID.
            entity_id: City/Event/Club identifier.
            score_delta: Points to add (km).
            scope: 'city', 'event', or 'club'.
        """
        key = cls._key(scope, entity_id)
        try:
            r = cls._get_redis()
            r.zincrby(key, score_delta, str(user_id))
            r.expire(key, _CACHE_TTL_S * 60)  # extend TTL on write
        except Exception as exc:
            logger.warning(
                "leaderboard.update_failed scope=%s entity=%s err=%s",
                scope, entity_id, exc,
            )

    # ------------------------------------------------------------------
    # Batch recalculation (Milestone 2 — Redis pipeline)
    # ------------------------------------------------------------------

    @classmethod
    def batch_recalculate(
        cls,
        entity_id: str | int,
        scores: dict[int, float],
        scope: str = "city",
    ) -> None:
        """
        Atomically replaces leaderboard scores for an entire entity using a
        Redis pipeline. This is O(N) with a single round-trip instead of
        N individual ZINCRBY calls.

        Used by: recalculate_city_leaderboard() Celery task.

        Args:
            entity_id: City/Event/Club ID.
            scores: Dict of {user_id: total_km}.
            scope: Leaderboard scope.
        """
        if not scores:
            return

        key = cls._key(scope, entity_id)
        ts_key = f"{key}:ts"

        try:
            r = cls._get_redis()
            with r.pipeline() as pipe:
                # Atomically replace the entire sorted set
                pipe.delete(key)
                # ZADD format: {member: score}
                pipe.zadd(key, {str(uid): km for uid, km in scores.items()})
                pipe.expire(key, _CACHE_TTL_S * 60)
                pipe.set(ts_key, str(time.time()), ex=3600)
                pipe.execute()

            logger.info(
                "leaderboard.batch_recalc scope=%s entity=%s users=%d",
                scope, entity_id, len(scores),
            )
        except Exception as exc:
            logger.error(
                "leaderboard.batch_recalc_failed scope=%s entity=%s err=%s",
                scope, entity_id, exc,
            )

    @classmethod
    def get_last_recalculated(cls, entity_id: str | int, scope: str = "city") -> float | None:
        """Returns unix timestamp of last batch recalculation, or None."""
        key = f"{cls._key(scope, entity_id)}:ts"
        try:
            val = cls._get_redis().get(key)
            return float(val) if val else None
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    @classmethod
    def get_top_users(
        cls,
        entity_id: str | int,
        limit: int = 50,
        scope: str = "city",
    ) -> list[dict]:
        """
        Returns top N users from the leaderboard.

        Response time: <5ms (served from Redis).

        Args:
            entity_id: City/Event/Club ID.
            limit: Maximum number of results.
            scope: Leaderboard scope.

        Returns:
            List of dicts with 'user_id', 'score_km', 'rank'.
        """
        key = cls._key(scope, entity_id)
        try:
            rows = cls._get_redis().zrevrange(key, 0, limit - 1, withscores=True)
            return [
                {"user_id": uid, "score_km": round(score, 3), "rank": i + 1}
                for i, (uid, score) in enumerate(rows)
            ]
        except Exception as exc:
            logger.error("leaderboard.read_failed scope=%s entity=%s err=%s", scope, entity_id, exc)
            return []

    @classmethod
    def get_user_rank(
        cls,
        entity_id: str | int,
        user_id: int,
        scope: str = "city",
    ) -> int | None:
        """
        Returns 1-indexed rank of a user, or None if not in leaderboard.

        Args:
            entity_id: City/Event/Club ID.
            user_id: User to rank.
            scope: Leaderboard scope.
        """
        key = cls._key(scope, entity_id)
        try:
            rank = cls._get_redis().zrevrank(key, str(user_id))
            return int(rank) + 1 if rank is not None else None
        except Exception as exc:
            logger.warning("leaderboard.rank_failed err=%s", exc)
            return None

    @classmethod
    def get_user_score(
        cls,
        entity_id: str | int,
        user_id: int,
        scope: str = "city",
    ) -> float:
        """Returns the user's current score (km), or 0.0 if not found."""
        key = cls._key(scope, entity_id)
        try:
            score = cls._get_redis().zscore(key, str(user_id))
            return float(score) if score is not None else 0.0
        except Exception:
            return 0.0

    # ------------------------------------------------------------------
    # Maintenance
    # ------------------------------------------------------------------

    @classmethod
    def reset(cls, entity_id: str | int, scope: str = "city") -> None:
        """
        Deletes a leaderboard (used after event COMPLETED transition).

        Args:
            entity_id: Entity to reset.
            scope: Leaderboard scope.
        """
        key = cls._key(scope, entity_id)
        try:
            cls._get_redis().delete(key, f"{key}:ts")
            logger.info("leaderboard.reset scope=%s entity=%s", scope, entity_id)
        except Exception as exc:
            logger.warning("leaderboard.reset_failed err=%s", exc)
