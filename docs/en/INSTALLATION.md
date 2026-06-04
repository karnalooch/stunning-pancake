# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../INSTALLATION.md) |
| **canonical_path** | docs/en/INSTALLATION.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Developer onboarding |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Developers |

Detailed installation instructions for the 4VELO platform in three variants: local development, Docker Compose and Railway.

**Related:** [operations/BROUTER.md](./operations/BROUTER.md) · [GETTING_STARTED.md](./GETTING_STARTED.md)

---

## 🖥️ Option 1: Local Development

### Step 1: System Requirements

Make sure you have installed:

| Tool | Version | Verification command |
|-----------|--------|----------------------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| PostgreSQL | 15+ (with PostGIS) | `psql --version` |
| Redis | 7+ | `redis-cli --version` |
| Git | 2.30+ | `git --version` |

### Step 2: Clone the repository```bash
git clone https://github.com/your-org/4velo.git
cd 4velo
```### Step 3: Backend configuration```bash
cd backend

# Utwórz wirtualne środowisko
python -m venv venv

# Aktywuj (Windows)
venv\Scripts\activate
# Aktywuj (Linux/macOS)
source venv/bin/activate

# Zainstaluj zależności
pip install -r requirements.txt
```### Step 4: Database configuration```bash
# Utwórz bazę danych
psql -U postgres
CREATE DATABASE 4velo_db;
CREATE USER 4velo_user WITH PASSWORD 'CHANGE_ME_strong_password';
GRANT ALL PRIVILEGES ON DATABASE 4velo_db TO 4velo_user;
\c 4velo_db
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\q
```### Step 5: Environment configuration```bash
# W katalogu głównym projektu
cp .env.example .env

# Edytuj .env i ustaw:
# - SECRET_KEY (wygeneruj bezpieczny klucz)
# - DB_PASSWORD (hasło do bazy)
# - DEBUG=1 (dla developmentu)
```Generating SECRET_KEY:```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```### Step 6: Migrations and seed data```bash
cd backend

# Uruchom migracje
python manage.py migrate

# Utwórz administratora
python manage.py create_admin

# Załaduj dane testowe
python manage.py seed_data

# Seed RBAC (system uprawnień)
python manage.py seed_rbac
```### Step 7: Launch the backend```bash
python manage.py runserver
```Backend available at: http://localhost:8000

### Step 8: Frontend configuration (Admin Panel)```bash
cd admin

# Zainstaluj zależności
npm install --legacy-peer-deps

# Uruchom development server
npm run dev
```Admin Panel available at: http://localhost:5173

---

## 🐳 Option 2: Docker Compose

### Step 1: Requirements

| Tool | Version |
|-----------|--------|
| Docker | 20/10+ |
| Docker Compose | 2.0+ |

### Step 2: Configuration```bash
# Skopiuj plik konfiguracyjny
cp .env.example .env

# Wygeneruj SECRET_KEY
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(50))" >> .env
```### Step 3: Startup```bash
# Development (wszystkie serwisy)
docker compose up -d

# Lub przez skrypt PowerShell (Windows)
.\dev.ps1
```### Step 4: Verification```bash
# Sprawdź status kontenerów
docker compose ps

# Sprawdź logi
docker compose logs backend
docker compose logs db
```### Available services

| Service | Port | Description |
|--------|------|------|
| backend | 8000 | Django REST API |
| global_admin | 3001 | Global Admin Panel |
| tenant_admin | 3002 | Tenant Admin Panel |
| moderator | 3003 | Moderator Panel |
| telemetry | 8001 | FastAPI Telemetry |
| db | 5432 | PostgreSQL + PostGIS |
| redis | 6379 | Redis Cache |
| brouter | 17777 | BRouter (anti-cheat + live simulator) |
| celery_worker_simulation | — | Batch/live sim, `simulation` queue |
| traccar | 8082 | Traccar (telemetry) |

### BRouter (Compose)

- Image: `infrastructure/brouter/Dockerfile` (BRouter 1.7.9, preset Poland).
- Segments: volume `./infrastructure/brouter/segments4` (first start may download ~1 GB of tiles).
- Simulation worker: `BROUTER_URL=http://brouter:17777/brouter` (already in `docker-compose.yml`).

Details: [operations/BROUTER.md](./operations/BROUTER.md), [infrastructure/brouter/README.md](../../infrastructure/brouter/README.md).```bash
# Sprawdzenie routingu (po starcie kontenera)
curl -s "http://localhost:17777/brouter?lonlats=21.01,52.23|21.02,52.24&profile=trekking&format=geojson" | head -c 200
```### Step 5: Migrations in Docker```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py create_admin
docker compose exec backend python manage.py seed_data
docker compose exec backend python manage.py seed_rbac
```---

## 🚂 Option 3: Railway (Cloud)

### Step 1: Preparation

1. Register on [railway.app](https://railway.app)
2. Connect your GitHub account
3. Install Railway CLI:```bash
npm i -g @railway/cli
railway login
```### Step 2: Deploy the backend

The backend uses `railway.json` for automatic configuration:```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false,
    "restartPolicy": "ALWAYS"
  }
}
```1. W Railway Dashboard click "New Project"
2. Select "Deploy from GitHub repo"
3. Railway will automatically detect `railway.json`

### Step 3: Configure Variables

W Railway → Backend → Additional Variables:```
SECRET_KEY=<wygenerowany-klucz>
DEBUG=0
ALLOWED_HOSTS=<twoja-domena>.up.railway.app
```Railway automatically delivers:
- `DATABASE_URL` (PostgreSQL)
- `REDIS_URL` (Redis)

### Step 4: Migrations```bash
# Przez Railway Shell
railway run python manage.py migrate
railway run python manage.py create_admin
railway run python manage.py seed_data
railway run python manage.py seed_rbac
```### Step 5: Deploy admin panel

1. In the Railway Dashboard, add a new service
2. Select "Deploy from GitHub repo"
3. Select the `admin/` directory
4. Railway will use `admin/railway.json`

---

## 📋 Environment variable reference

### Database

| Variable | Required | Default | Description |
|---------|----------|----------|------|
| `POSTGRES_DB` | ✅ | `4velo_db` | Database name |
| `POSTGRES_USER` | ✅ | `4velo_user` | Database username |
| `DB_PASSWORD` | ✅ | — | Database password |
| `DATABASE_URL` | ⚠️ | — | Full database URL (Railway) |

### Django

| Variable | Required | Default | Description |
|---------|----------|----------|------|
| `SECRET_KEY` | ✅ | — | Session key/JWT |
| `DEBUG` | ✅ | `0` | Debug mode (1=on, 0=off) |
| `ALLOWED_HOSTS` | ⚠️ | `*` | Allowed hosts (comma separated) |

### Redis

| Variable | Required | Default | Description |
|---------|----------|----------|------|
| `REDIS_URL` | ✅ | `redis://redis:6379/0` | URL to Redis |
| `REDIS_CLUSTER_NODES` | ❌ | — | Redis cluster nodes |

### Anti-Cheat

| Variable | Default | Description |
|---------|----------|------|
| `GATE_TELEPORT_M` | 500 | Max GPS jump (meters) |
| `GATE_MAX_ACCEL` | 6.0 | Max acceleration (m/s²) |
| `GATE_MOTOR_VAR` | 0.05 | Max σ/μ motor fingerprint |
| `GATE_STRAIGHT_RATIO` | 0.92 | Min ratio of the straight line to the route |
| `GATE_MOTOR_MIN_SEG` | 15 | Min segments for motor check |
| `VMAX_ANOMALY_RATIO` | 0.20 | Max anomaly ratio |
| `VMAX_CONSECUTIVE` | 3 | Max consecutive violations |
| `VMAX_MARGIN` | 1.10 | Speed ​​Margin |

### External integrations

| Variable | Description |
|---------|------|
| `STRIPE_SECRET_KEY` | Stripe (Payments) API Key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `SENDGRID_API_KEY` | SendGrid API Key (emails) |
| `FROM_EMAIL` | Email sender address |
| `FROM_NAME` | Email sender name |
| `STRAVA_CLIENT_ID` | Client ID Strava OAuth |
| `STRAVA_CLIENT_SECRET` | Client Secret Strava OAuth |
| `STRAVA_REDIRECT_URI` | Redirect URI Strava |
| `GARMIN_CLIENT_ID` | Client ID Garmin OAuth |
| `GARMIN_CLIENT_SECRET` | Client Secret Garmin OAuth |
| `GARMIN_REDIRECT_URI` | Redirect URI Garmin |
| `OPENAI_API_KEY` | OpenAI API Key (LLM coaching) |
| `GOOGLE_API_KEY` | Google API Key (Image Generation) |
| `SENTRY_DSN` | DSN Sentry (monitoring) |
| `SENTRY_ENVIRONMENT` | Sentry Environment (production/staging) |

---

## 🗄️ Database setup

### PostgreSQL + PostGIS

The platform requires PostgreSQL with extensions:```sql
-- Utwórz rozszerzenia
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS hstore;
```### Row Level Security (RLS)

RLS is enabled automatically by migrations:```bash
python manage.py migrate
python apply_rls.py  # Ręczne zastosowanie polityk RLS
```---

## 🔄 Starting the migration```bash
# Sprawdź stan migracji
python manage.py showmigrations

# Uruchom wszystkie migracje
python manage.py migrate

# Uruchom migracje dla konkretnej aplikacji
python manage.py migrate users
python manage.py migrate activities

# Cofnij ostatnią migrację
python manage.py migrate users 0008

# Utwórz nową migrację po zmianach w modelach
python manage.py makemigrations
python manage.py makemigrations users
python manage.py makemigrations activities
```---

## 🌱 Data seeding

### Test data```bash
# Seedowanie danych testowych (użytkownicy, tenanci, aktywności)
python manage.py seed_data

# Seedowanie z czyszczeniem istniejących danych
python manage.py seed_data --clear
```### RBAC seeding```bash
# Seedowanie systemu RBAC (role, permissions, assignments)
python manage.py seed_rbac
```### Admin password repair```bash
# Reset hasła administratora
python manage.py fix_admin_password
```---

## ✅ Installation verification

### Backend```bash
# Sprawdź health endpoint
curl http://localhost:8000/api/infra/health/

# Sprawdź API docs
curl http://localhost:8000/api/docs/

# Uruchom testy
cd backend
python run_tests.py
```### Frontend```bash
# Otwórz w przeglądarce
http://localhost:5173

# Lub uruchom testy E2E
cd admin
npm run test:e2e
```---

> **Next step:** [⚙️ Configuration Guide](./CONFIGURATION.md)
