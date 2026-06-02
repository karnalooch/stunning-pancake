"""
Celery task registration for the `users` app.
Celery autodiscovery imports `<app>.tasks` modules; we re-export our bulk task.
"""

from .bulk_tasks import bulk_action_task  # noqa: F401

