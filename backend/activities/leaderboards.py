import redis
import os
from django.conf import settings

class LeaderboardService:
    """
    Service for managing real-time leaderboards using Redis Sorted Sets.
    """
    _redis = redis.from_url(os.getenv('REDIS_URL', 'redis://redis:6379/0'))

    @classmethod
    def update_score(cls, user_id, city_id, score_delta):
        """
        Increments the user's score in the city's leaderboard.
        """
        key = f"leaderboard:city:{city_id}"
        cls._redis.zincrby(key, score_delta, user_id)

    @classmethod
    def get_top_users(cls, city_id, limit=10):
        """
        Returns the top users for a given city.
        """
        key = f"leaderboard:city:{city_id}"
        results = cls._redis.zrevrange(key, 0, limit - 1, withscores=True)
        return [{"user_id": r[0].decode(), "score": r[1]} for r in results]

    @classmethod
    def get_user_rank(cls, city_id, user_id):
        """
        Returns the rank of a specific user.
        """
        key = f"leaderboard:city:{city_id}"
        rank = cls._redis.zrevrank(key, user_id)
        if rank is not None:
            return rank + 1
        return None
