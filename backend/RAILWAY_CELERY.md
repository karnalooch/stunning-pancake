# Railway Deployment — Celery Worker & Beat

Railway does **not** support running multiple processes from a single
`railway.json` Dockerfile definition.  Celery worker and Celery beat must
therefore be deployed as **separate Railway services**, each with its own
Dockerfile, `railway.json`, and database/REDIS connection variables.

---

## 1. Celery Worker Service

### 1.1 Create a new Railway service

- Go to your Railway project dashboard.
- Click **New Service** → **Empty Service**.
- Name it e.g. `celery-worker`.

### 1.2 Source & build

- Link the **same Git repository** as your main backend service.
- Set **Root Directory** to `backend/`.
- In the service **Settings** tab, set:
  ```
  Custom Dockerfile Path = Dockerfile.celery
  ```

### 1.3 Environment variables

Copy **all** variables from your main backend service that Celery needs:

| Variable | Notes |
|---|---|
| `SECRET_KEY` | Same as backend |
| `DEBUG` | `0` |
| `DATABASE_URL` | **Same Postgres URL** as backend |
| `REDIS_URL` | **Same Redis URL** as backend (Celery broker + result backend) |
| `ALLOWED_HOSTS` | Same as backend |
| `SENDGRID_API_KEY` | For notification tasks |
| `FROM_EMAIL` | For notification tasks |
| `FROM_NAME` | For notification tasks |
| `SENTRY_DSN` | (optional) Error tracking |
| `SENTRY_ENVIRONMENT` | `production` |
| `OPENAI_API_KEY` | For ML retraining tasks |
| `ML_MODEL_PATH` | `/app/models/anomaly_detector.pkl` |
| Any other variables referenced by your Celery tasks | |

### 1.4 Start command

No override needed — `Dockerfile.celery` already defines:
```
celery -A core worker --loglevel=info --queues=critical,default,notifications --concurrency=2 --max-tasks-per-child=1000
```

---

## 2. Celery Beat Service

### 2.1 Create a new Railway service

- Click **New Service** → **Empty Service**.
- Name it e.g. `celery-beat`.

### 2.2 Source & build

- Link the **same Git repository**.
- Set **Root Directory** to `backend/`.
- In the service **Settings** tab, set:
  ```
  Custom Dockerfile Path = Dockerfile.celerybeat
  ```

### 2.3 Environment variables

Same variables as the Celery worker (see §1.3), plus:

| Variable | Value | Notes |
|---|---|---|
| `DJANGO_SETTINGS_MODULE` | `core.settings` | May already be set by Dockerfile |
| `DATABASE_URL` | *(same as backend)* | Beat uses Django DB for schedule persistence |

### 2.4 Start command

No override needed — `Dockerfile.celerybeat` already defines:
```
celery -A core beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

---

## 3. Beat Schedule

All 5 periodic tasks are defined in **`core/settings.py`** under
`CELERY_BEAT_SCHEDULE`.  The `celery.py` file no longer defines its own
`beat_schedule`, so there is a single source of truth:

| Task ID | Task function | Schedule |
|---|---|---|
| `ml-model-retrain-weekly` | `activities.tasks.retrain_ml_model` | Monday 03:00 |
| `refresh-city-rankings-mv` | `activities.tasks.refresh_city_rankings_mv` | Every 5 min |
| `weekly-leaderboard-digest` | `activities.tasks.send_leaderboard_digest` | Monday 09:00 |
| `city-leaderboard-recalculate` | `activities.tasks.recalculate_city_leaderboard` | Every 15 min |
| `daily-event-cleanup` | `events.tasks.close_expired_events` | Daily 02:00 |

---

## 4. Railway Health Check (optional)

Worker and beat services don't expose HTTP ports.  Disable the Railway
health-check by setting **Healthcheck Path** to an empty value in the
service **Settings** tab, or deploy with:

```json
{
  "deploy": {
    "healthcheckPath": ""
  }
}
```

---

## 5. Scaling

- **Celery worker**: Increase `numReplicas` in the service's Railway settings
  to scale horizontally.  Also consider raising `--concurrency` in
  `Dockerfile.celery`.
- **Celery beat**: Keep `numReplicas = 1` to avoid duplicate schedule
  execution.

---

## 6. Verify Deployment

1. Open Railway logs for `celery-worker` — you should see:
   ```
   [queues] celery@... ready.
   ```
2. Open Railway logs for `celery-beat` — you should see:
   ```
   beat: Starting...
   Scheduler: Scheduler django_celery_beat.schedulers:DatabaseScheduler
   ```
3. Trigger a test task from the Django shell (run in backend service):
   ```python
   from activities.tasks import recalculate_city_leaderboard
   recalculate_city_leaderboard.delay()
   ```
   The worker logs should show the task being received and processed.
