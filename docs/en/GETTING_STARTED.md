# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../GETTING_STARTED.md) |
| **canonical_path** | docs/en/GETTING_STARTED.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Developer onboarding |
| **Last reviewed** | 2026-06-03 |
| **Audience** | New developers |

Launch the 4VELO platform in 15 minutes.

**Related:** [INSTALLATION.md](./INSTALLATION.md) · [DEVELOPMENT.md](./DEVELOPMENT.md) · [README.md](./README.md)

---

## 📋 Prerequisites

### Required software

| Tool | Version | Description |
|-----------|--------|------|
| [Python](https://www.python.org/downloads/) | 3.11+ | Backend (Django) |
| [Node.js](https://nodejs.org/) | 18+ | Frontend (Admin Panel) |
| [Docker](https://www.docker.com/) | 20/10+ | Containerization |
| [Docker Compose](https://docs.docker.com/compose/) | 2.0+ | Container orchestration |

### Optional

| Tool | Version | Description |
|-----------|--------|------|
| [PostgreSQL](https://www.postgresql.org/) | 15+ | Local database (instead of Docker) |
| [Redis](https://redis.io/) | 7+ | Local cache (instead of Docker) |
| [Git](https://git-scm.com/) | 2.30+ | Version control |

---

## 🚀 Option 1: Docker Compose (Recommended)

The fastest way to run a full stack.

### Step 1: Clone the repository```bash
git clone https://github.com/your-org/4velo.git
cd 4velo
```### Step 2: Environment configuration```bash
# Skopiuj plik konfiguracyjny
cp .env.example .env

# Wygeneruj bezpieczny SECRET_KEY
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(50))" >> .env
```### Step 3: Startup```bash
# Windows PowerShell
.\dev.ps1

# Lub bezpośrednio Docker Compose
docker compose up -d
```### Step 4: Verification

Service | URL | Status
-------|-----|-------
Backend API | http://localhost:8000 | ✅
Global Admin | http://localhost:3001 | ✅
Tenant Admin | http://localhost:3002 | ✅
Moderator | http://localhost:3003 | ✅
Telemetry | http://localhost:8001 | ✅
PostgreSQL | localhost:5432 | ✅
Redis | localhost:6379 | ✅
Swagger Docs | http://localhost:8000/api/docs/ | ✅
BRouter | http://localhost:17777/brouter | ✅ (Compose) |
Celery simulation | `simulation` queue | ✅ (`celery_worker_simulation`) |

### Simulator / Live Map (optional)

For load tests from the admin panel (user batch + live map):

1. Make sure `brouter` and `celery_worker_simulation` (`docker compose ps`) are running.
2. Log in as admin → **Simulator** - first batch, then live (UI waits for the end of the batch).
3. Runbook: [operations/SIMULATOR.md](./operations/SIMULATOR.md).

---

## 🚀 Option 2: Railway (Cloud)

Fast cloud deployment without infrastructure configuration.

### Step 1: Railway account

1. Register on [railway.app](https://railway.app)
2. Connect your GitHub account

### Step 2: Deploy

1. Click the "Deploy from GitHub" button in Railway
2. Select the 4VELO repository
3. Railway will automatically detect `railway.json` and configure the service

### Step 3: Environment Variables

In the Railway → Backend → Variables panel, add:```
SECRET_KEY=<wygenerowany-klucz>
DATABASE_URL=<URL-bazy-Railway>
REDIS_URL=<URL-Redis-Railway>
```### Step 4: Migrations```bash
# Przez Railway Shell
railway run python manage.py migrate
railway run python manage.py create_admin
railway run python manage.py seed_data
```---

## 🔐 First login

### Default administrator details

After running with seed data:

| Field | Value |
|------|---------|
| Username | `global_owner` |
| Password | `admin123` |
| Role | `GLOBAL_OWNER` |

### Change password

1. Log in to the admin panel
2. Go to Settings → Change Password
3. Or via API:```bash
curl -X POST http://localhost:8000/api/users/password/change/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"old_password": "admin123", "new_password": "nowe_bezpieczne_haslo"}'
```---

## ✅ What's next?

After first launch:

1. **📖 Read [Architecture](../ARCHITECTURE.md)** - understand system architecture
2. **⚙️ Configure [Configuration](./CONFIGURATION.md)** - adjust environment variables
3. **🛡️ Get to know [RBAC](./RBAC.md)** - learn how to manage permissions
4. **📡 Check [API Reference](../API.md)** - endpoints, including admin simulator (§ Admin)
5. **🚂 Load test:** [operations/](./operations/) — Railway worker + BRouter
6. **🧪 Run tests** - verify correct installation:```bash
cd backend
python run_tests.py
```---

## 🆘 Need help?

- [🔍 Troubleshooting](./TROUBLESHOOTING.md) - Troubleshooting common problems
- [📦 Installation Guide](./INSTALLATION.md) - detailed installation guide
- [💻 Development Guide](./DEVELOPMENT.md) - working with code
