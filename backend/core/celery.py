"""
Celery Configuration — SPORT Platform
=======================================
Constitution §9.2: Asynchronous Processing & Task Queues
Constitution §22.3: Notifications decoupled via Celery
"""

from __future__ import annotations

import os

from celery import Celery

from core.task_rls import GLOBAL_OWNER_TASK_HEADER

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# T73: every worker task starts and ends with a cleared PostgreSQL RLS context.
# Tasks that need protected tenant data opt into RequiredRLSScopedTask and must
# receive an explicit trusted tenant/global-owner header from their producer.
app = Celery("sport", task_cls="core.task_rls:RLSScopedTask")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# ---------------------------------------------------------------------------
# Queue routing — critical / notifications / default
# ---------------------------------------------------------------------------

app.conf.task_routes = {
    "activities.tasks.process_activity": {"queue": "critical"},
    "activities.tasks.send_leaderboard_digest": {"queue": "notifications"},
    "activities.tasks.recalculate_city_leaderboard": {"queue": "default"},
    "users.push_tasks.send_city_ranking_push": {"queue": "notifications"},
    "users.push_tasks.send_quest_push": {"queue": "notifications"},
    "users.push_tasks.send_season_end_push": {"queue": "notifications"},
    "users.tasks.enforce_data_retention": {"queue": "default"},
    "activities.wipe_tasks.*": {"queue": "default"},
    "activities.simulator_tasks.route_live_ride_task": {"queue": "routing"},
    "activities.simulator_tasks.*": {"queue": "simulation"},
    "*": {"queue": "default"},
}

app.conf.task_queue_max_priority = 10
app.conf.task_default_priority = 5

# ---------------------------------------------------------------------------
# Celery Beat — configured via settings.CELERY_BEAT_SCHEDULE
# ---------------------------------------------------------------------------

app.conf.beat_scheduler = "django_celery_beat.schedulers:DatabaseScheduler"
app.conf.beat_schedule = {
    **(app.conf.beat_schedule or {}),
    "privacy-data-retention-daily": {
        "task": "users.tasks.enforce_data_retention",
        "schedule": 86400.0,
        "options": {"queue": "default"},
    },
}

# These periodic jobs intentionally inspect or maintain data across tenants.
# Beat is trusted server-side code, so grant the narrow internal GLOBAL_OWNER
# RLS context explicitly instead of relying on a privileged PostgreSQL role.
_GLOBAL_OWNER_BEAT_JOBS = {
    "ml-model-retrain-weekly",
    "refresh-city-rankings-mv",
    "city-leaderboard-recalculate",
    "warm-dashboard-stats-cache",
    "postgres-disk-monitor",
    "live-map-alert-detector",
}
for _job_name in _GLOBAL_OWNER_BEAT_JOBS:
    _entry = app.conf.beat_schedule.get(_job_name)
    if not _entry:
        continue
    _entry = dict(_entry)
    _options = dict(_entry.get("options") or {})
    _headers = dict(_options.get("headers") or {})
    _headers[GLOBAL_OWNER_TASK_HEADER] = True
    _options["headers"] = _headers
    _entry["options"] = _options
    app.conf.beat_schedule[_job_name] = _entry


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
