"""
Celery task registration for the `users` app.
Celery autodiscovery imports `<app>.tasks` modules; we re-export our bulk task.
"""

from .bulk_tasks import bulk_action_task  # noqa: F401
from .push_tasks import (  # noqa: F401
    send_city_ranking_push,
    send_quest_push,
    send_season_end_push,
)
