# DEVELOPER QUICKSTART: SPORT PLATFORM v0.2.0 (MILESTONE 2)

> Time to running stack: **~10 minutes** (assuming Docker and Git are installed)

## 🏗 Prerequisites

| Tool | Minimum Version | Note |
|:---|:---|:---|
| Docker / Podman | 24.0+ | Mandatory for infrastructure |
| Docker Compose | v2.24+ | V2 required (not `docker-compose`) |
| Node.js | v20+ | For `admin/` and `mobile/` development |
| Python | 3.12+ | For local `backend/` debugging |

---

## 1. Clone & Initialize

```bash
git clone https://github.com/karnalooch/stunning-pancake.git sport
cd sport
cp .env.example .env
```

### Configure Secrets
Generate a 50-char hex key and fill `.env`:
```bash
python -c "import secrets; print(secrets.token_hex(50))"
```

---

## 2. Infrastructure Spin-up

```bash
docker compose up --build -d
```

### Core Services
| Service | Role | Port |
|:---|:---|:---|
| `sport_db` | TimescaleDB + PostGIS | 5432 |
| `sport_redis` | Cache & Leaderboards | 6379 |
| `sport_traccar` | Telemetry Core | 8082 |
| `sport_brouter` | OSM Routing Engine | 17777 |
| `sport_backend` | Django REST API | 8000 |
| `sport_telemetry` | FastAPI Ingestion | 8001 |
| `sport_admin` | React Dashboard | 5173 |

---

## 3. Database Initialization

```bash
# Run migrations
docker compose exec backend python manage.py migrate

# Initialize materialized views
docker compose exec backend python manage.py shell -c "from activities.tasks import refresh_city_rankings_mv; refresh_city_rankings_mv()"

# Create administrative account
docker compose exec backend python manage.py createsuperuser
```

---

## 4. Verification Endpoints

- **Admin Dashboard**: `http://localhost:5173` (Login using your superuser)
- **Moderator Panel**: `http://localhost:5173/moderator`
- **Django API Docs**: `http://localhost:8000/api/docs/`
- **Telemetry Health**: `http://localhost:8001/api/telemetry/health`

---

## 5. Development Workflow

### Backend (Django)
Run tests to verify the 3-layer anti-cheat pipeline:
```bash
docker compose exec backend pytest activities/tests.py
```

### Frontend (Admin)
Run in dev mode for HMR:
```bash
cd admin && npm install && npm run dev
```

### Mobile (React Native)
Ensure Expo Go is on your device:
```bash
cd mobile && npm install && npx expo start
```

---

## 🏁 Architecture Overview

```
MOBILE (RN) → [Batch 30s] → FASTAPI (8001) → REDIS (Direct) → TIMESCALEDB
                                             ↓
                                      WEBSOCKET (Live Map)
                                             ↓
                               ACTIVITY FINISH (Celery Task)
                                 1. Fast Selection Gate (O(N))
                                 2. V-max Kinematic Check
                                 3. BRouter Map-Matching
                                 4. Leaderboard Sync (Redis)
```
