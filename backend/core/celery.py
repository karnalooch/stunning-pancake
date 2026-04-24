"""
Celery Configuration — SPORT Platform
=======================================
Constitution §9.2: Asynchronous Processing & Task Queues
Constitution §22.3: Notifications decoupled via Celery
"""
from __future__ import annotations

import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('sport')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# ---------------------------------------------------------------------------
# Queue routing — critical / notifications / default
# ---------------------------------------------------------------------------

app.conf.task_routes = {
    'activities.tasks.process_activity':        {'queue': 'critical'},
    'activities.tasks.send_leaderboard_digest': {'queue': 'notifications'},
    '*':                                         {'queue': 'default'},
}

app.conf.task_queue_max_priority = 10
app.conf.task_default_priority = 5

# ---------------------------------------------------------------------------
# Celery Beat — periodic tasks
# ---------------------------------------------------------------------------

app.conf.beat_schedule = {
    # Every Monday 08:00 — weekly leaderboard digest
    'weekly-leaderboard-digest': {
        'task': 'activities.tasks.send_leaderboard_digest',
        'schedule': crontab(hour=8, minute=0, day_of_week='monday'),
        'kwargs': {'city_id': 'siedlce', 'top_n': 10},
    },
    # Every day 00:05 — close expired events, reset Redis leaderboards
    'daily-event-cleanup': {
        'task': 'events.tasks.close_expired_events',
        'schedule': crontab(hour=0, minute=5),
    },
}

app.conf.beat_scheduler = 'django_celery_beat.schedulers:DatabaseScheduler'


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')

