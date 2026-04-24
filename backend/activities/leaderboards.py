import redis
import os
import logging

logger = logging.getLogger(__name__)


class LeaderboardService:
    """
    Real-time leaderboard engine using Redis Sorted Sets.

    Supports three scopes:
    - City/Tenant leaderboards (global city rankings)
    - Event leaderboards (per-event score)
    - Club leaderboards (club challenge tracking)

    All keys follow the pattern: leaderboard:<scope>:<id>
    """
    _redis = None  # Lazy init — connection created on first use

    @classmethod
    def _get_redis(cls):
        if cls._redis is None:
            cls._redis = redis.from_url(os.getenv('REDIS_URL', 'redis://redis:6379/0'))
        return cls._redis

    @classmethod
    def _key(cls, scope: str, entity_id: str | int) -> str:
        return f"leaderboard:{scope}:{entity_id}"

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    @classmethod
    def update_score(cls, user_id: int, entity_id: str | int, score_delta: float, scope: str = "city") -> None:
        """
        Increments a user's score in a leaderboard.

        Args:
            user_id: SPORT user ID.
            entity_id: City/Event/Club ID.
            score_delta: Points to add (km).
            scope: 'city', 'event', or 'club'.
        """
        key = cls._key(scope, entity_id)
        try:
            cls._get_redis().zincrby(key, score_delta, str(user_id))
        except Exception as exc:
            logger.warning("leaderboard.update_failed scope=%s entity=%s err=%s", scope, entity_id, exc)

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    @classmethod
    def get_top_users(cls, entity_id: str | int, limit: int = 10, scope: str = "city") -> list[dict]:
        """
        Returns the top-N users for a leaderboard.

        Args:
            entity_id: City/Event/Club ID.
            limit: Number of results.
            scope: Leaderboard scope.

        Returns:
            List of dicts with user_id and score.
        """
        key = cls._key(scope, entity_id)
        try:
            results = cls._get_redis().zrevrange(key, 0, limit - 1, withscores=True)
            return [{"user_id": r[0].decode(), "score": r[1]} for r in results]
        except Exception as exc:
            logger.warning("leaderboard.read_failed scope=%s entity=%s err=%s", scope, entity_id, exc)
            return []

    @classmethod
    def get_user_rank(cls, entity_id: str | int, user_id: int, scope: str = "city") -> int | None:
        """
        Returns the 1-indexed rank of a user in a leaderboard.

        Args:
            entity_id: City/Event/Club ID.
            user_id: SPORT user ID.
            scope: Leaderboard scope.

        Returns:
            1-indexed rank, or None if user is not ranked.
        """
        key = cls._key(scope, entity_id)
        try:
            rank = cls._get_redis().zrevrank(key, str(user_id))
            return (rank + 1) if rank is not None else None
        except Exception as exc:
            logger.warning("leaderboard.rank_failed scope=%s entity=%s err=%s", scope, entity_id, exc)
            return None

    @classmethod
    def reset(cls, entity_id: str | int, scope: str = "city") -> None:
        """Deletes a leaderboard (e.g. at end of event)."""
        key = cls._key(scope, entity_id)
        try:
            cls._get_redis().delete(key)
        except Exception as exc:
            logger.warning("leaderboard.reset_failed scope=%s entity=%s err=%s", scope, entity_id, exc)


