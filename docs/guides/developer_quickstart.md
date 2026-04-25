# DEVELOPER QUICKSTART: SPORT PLATFORM v1.0.0
> **Edition**: Hyperscale (Post Milestone 5) | Time to running stack: **~10 minutes**

## 🏗 Prerequisites

| Tool | Minimum Version | Note |
|:---|:---|:---|
| Docker / Podman | 24.0+ | Mandatory for all infrastructure |
| Docker Compose | v2.24+ | V2 required (not `docker-compose`) |
| Node.js | v20+ | For `admin/` and `mobile/` development |
| Python | 3.12+ | For local `backend/` debugging only |

---

## 1. Clone & Initialize

```bash
git clone https://github.com/karnalooch/stunning-pancake.git sport
cd sport
cp .env.example .env
```

Generate a secret key:
```bash
python -c "import secrets; print(secrets.token_hex(50))"
```
Fill `SECRET_KEY`, `POSTGRES_USER`, `POSTGRES_DB`, `DB_PASSWORD` in `.env`.

---

## 2. Infrastructure Spin-up

### Standard (Development / Staging)
```bash
docker compose up --build -d
```

### Hyperscale (Production — Redis Cluster + Citus)
```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml up --build -d
```

### Services Overview

| Service | Role | Port |
|:---|:---|:---|
| `sport_db` | TimescaleDB + PostGIS (dev) / Citus Coordinator (prod) | 5432 |
| `sport_redis` | Redis standalone (dev) / Cluster x6 (prod) | 6379 |
| `sport_backend` | Django REST API | 8000 |
| `sport_telemetry` | FastAPI GPS ingestion | 8001 |
| `sport_admin` | React Dashboard | 3000 |
| `sport_celery_worker` | Celery: critical + notifications queues | — |
| `sport_celery_beat` | Celery Beat scheduler | — |
| `sport_brouter` | OSM Routing Engine (anti-cheat Layer 3) | 17777 |
| `sport_traccar` | Device telemetry receiver | 8082 |

---

## 3. Database Initialization

```bash
# Run all Django migrations
docker compose exec backend python manage.py migrate

# Create superuser (for admin panel access)
docker compose exec backend python manage.py createsuperuser

# Initialize materialized views (City Rankings)
docker compose exec backend python manage.py shell -c \
  "from activities.tasks import refresh_city_rankings_mv; refresh_city_rankings_mv()"
```

### Hyperscale Only — Apply Citus Sharding
Run **after** the scale stack is up and migrations are complete:
```bash
docker compose exec backend python manage.py shell -c \
  "from core.citus import apply_citus_sharding; apply_citus_sharding()"
```

### Hyperscale Only — Apply PostgreSQL RLS
```bash
docker compose exec backend python manage.py shell -c \
  "from core.rls import apply_rls_policies; apply_rls_policies()"
```

---

## 4. Verification Endpoints

| Endpoint | Description |
|:---|:---|
| `http://localhost:3000` | Admin Dashboard |
| `http://localhost:8000/api/docs/` | Django REST API (Swagger UI) |
| `http://localhost:8001/api/telemetry/health` | Telemetry service health |
| `http://localhost:8000/api/infra/health/` | Redis + Citus cluster status (admin only) |
| `http://localhost:8000/api/infra/health/redis/` | Redis Cluster topology |
| `http://localhost:8000/api/infra/health/citus/` | Citus node + shard status |

---

## 5. Development Workflow

### Backend (Django)
```bash
# Run anti-cheat + leaderboard tests
docker compose exec backend python manage.py test activities

# Celery worker (local, outside Docker)
celery -A core worker -Q critical,default -l info
```

### Frontend (Admin)
```bash
cd admin && npm install && npm run dev   # HMR on :5173
```

### Mobile (React Native)
```bash
cd mobile && npm install && npx expo start
```

---

## 6. Architecture Overview (Full Pipeline)

```
MOBILE (RN 0.76)
  └─ GpsSyncManager v3 (battery-adaptive, MMKV buffer)
  └─ Privacy Zones v2 (on-device masking before upload)
  └─ SentryService (GPS-stripped error reporting)
       │ POST /api/telemetry/ingest/batch (every 30s)
       ▼
FASTAPI :8001 (asyncpg + Redis Pipeline)
  └─ <1ms ingestion → Redis buffer → TimescaleDB Hypertable
       │ Celery Task: process_activity
       ▼
ANTI-CHEAT PIPELINE (Celery `critical` queue)
  ├─ Layer 1:   Fast Selection Gate (O(N) math, ~0.5ms)
  ├─ Layer 1.5: ML IsolationForest (8 features, ~5ms)
  ├─ Layer 2:   V-max Biomechanical Check (~1ms)
  ├─ Layer 3:   BRouter Topological Viterbi (~200ms)
  └─ Layer 4:   Leaderboard Sync + Points Award
       │
       ▼
REDIS CLUSTER (3 masters + 3 replicas)
  └─ Sorted Sets: real-time rankings for 200 cities
       │
       ▼
CITUS POSTGRESQL (1 coordinator + 3 workers)
  └─ 32 shards per table, user_id co-location, RLS isolation
```

---

## 7. Key Environment Variables

| Variable | Purpose | Default |
|:---|:---|:---|
| `SECRET_KEY` | Django secret | Required |
| `DATABASE_URL` | PostgreSQL connection | Required |
| `REDIS_URL` | Single Redis (dev) | `redis://redis:6379/0` |
| `REDIS_CLUSTER_NODES` | Cluster nodes (prod) | Empty = standalone |
| `SENTRY_DSN` | Error tracking | Empty = disabled |
| `STRIPE_SECRET_KEY` | Payments | Empty = mock mode |
| `ML_MODEL_PATH` | Anti-cheat model | `/app/models/anomaly_detector.pkl` |
| `ML_ANOMALY_THRESHOLD` | Rejection threshold | `-0.15` |

Full reference: see `.env.example`
