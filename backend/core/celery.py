"""
Celery Configuration — SPORT Platform
=======================================
Constitution §9.2: Asynchronous Processing & Task Queues
Constitution §22.3: Notifications decoupled via Celery
"""
from __future__ import annotations

import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('sport')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# ---------------------------------------------------------------------------
# Queue routing — critical / notifications / default
# ---------------------------------------------------------------------------

app.conf.task_routes = {
    'activities.tasks.process_activity':              {'queue': 'critical'},
    'activities.tasks.send_leaderboard_digest':       {'queue': 'notifications'},
    'activities.tasks.recalculate_city_leaderboard':  {'queue': 'default'},
    '*':                                               {'queue': 'default'},
}

app.conf.task_queue_max_priority = 10
app.conf.task_default_priority = 5

# ---------------------------------------------------------------------------
# Celery Beat — configured via settings.CELERY_BEAT_SCHEDULE
# ---------------------------------------------------------------------------

app.conf.beat_scheduler = 'django_celery_beat.schedulers:DatabaseScheduler'


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')

