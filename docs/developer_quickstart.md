# Developer Quickstart — SPORT Platform v0.1.0-alpha

> Time to running stack: **~15 minutes** (assuming Docker and Git are installed)

## Prerequisites

| Tool | Minimum Version |
|:---|:---|
| Docker / Podman | 24.0+ |
| Docker Compose | v2.24+ |
| Git | 2.40+ |

---

## 1. Clone the repository

```bash
git clone https://github.com/karnalooch/stunning-pancake.git sport
cd sport
```

---

## 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in **all** fields marked `CHANGE_ME`:

```bash
# Generate a secure SECRET_KEY:
python -c "import secrets; print(secrets.token_hex(50))"

# Set a strong DB password and paste the SECRET_KEY output into .env
DB_PASSWORD=your_strong_password_here
SECRET_KEY=<paste output from above>
```

> **Warning:** Never commit `.env` to version control. It is already listed in `.gitignore`.

---

## 3. Start the stack

```bash
docker compose up --build -d
```

On first run Docker will pull images (~5 min). Subsequent starts take ~20 seconds.

Check container status:

```bash
docker compose ps
```

Expected containers with status `Up`:

```
sport_db            — TimescaleDB + PostGIS    :5432
sport_redis         — Redis 7                  :6379
sport_traccar       — Traccar 6                :8082
sport_brouter       — BRouter 1.7             :17777
sport_backend       — Django API              :8000
sport_telemetry     — FastAPI Telemetry       :8001
sport_admin         — React Admin Dashboard   :3000
sport_celery_worker — Celery Worker (critical queue)
sport_celery_beat   — Celery Beat (periodic tasks)
```

---

## 4. Run migrations and create superuser

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

---

## 5. Verification

| Endpoint | Expected Response |
|:---|:---|
| `http://localhost:8000/api/docs/` | Swagger UI (Django REST API) |
| `http://localhost:8001/api/telemetry/docs` | Swagger UI (FastAPI Telemetry) |
| `http://localhost:8001/api/telemetry/health` | `{"status": "ok"}` |
| `http://localhost:3000/` | Admin Dashboard (login screen) |
| `http://localhost:8082/` | Traccar Web UI |

---

## 6. Running tests

```bash
# Via Docker (recommended)
docker compose exec backend python manage.py test --verbosity=2

# Locally (after: pip install -r backend/requirements.txt)
cd backend && pytest -q
```

---

## Architecture overview

```
Mobile GPS  → [30s batch]       → FastAPI :8001  → TimescaleDB hypertable
Traccar     → [Redis pub/sub]   → FastAPI        → WebSocket → Admin Live Map
Activity.finish() → Celery → Kalman Filter → Viterbi HMM → BRouter → Leaderboard
```

Full documentation: [`docs/constitution.md`](constitution.md) | [`docs/project_structure.md`](project_structure.md)

---

## Troubleshooting

**Container `db` fails to start:**
Make sure `DB_PASSWORD`, `POSTGRES_USER`, and `POSTGRES_DB` are all set in `.env`.

```bash
docker compose logs db
```

**Backend raises `KeyError: DATABASE_URL`:**
Ensure `.env` is in the project root directory and contains `DATABASE_URL`.

**Traccar cannot connect to database:**
Verify that `TRACCAR_DB_PASSWORD` in `.env` matches `DB_PASSWORD`.

```bash
docker compose logs traccar
```

**WebSocket live map shows "CONNECTING" indefinitely:**
The FastAPI telemetry service must be running and `REDIS_URL` must be correctly set.

```bash
docker compose logs telemetry
```
