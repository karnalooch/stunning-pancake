# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../DEPLOYMENT.md) |
| **canonical_path** | docs/en/DEPLOYMENT.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator / DevOps |
| **Last reviewed** | 2026-06-03 |
| **Audience** | DevOps, release |

A complete guide to implementing the 4VELO platform in a production environment - Railway, Docker Compose, SSL, backups and monitoring.

**SSOT Railway workers:** [operations/RAILWAY_PRODUCTION_CHECKLIST.md](./operations/RAILWAY_PRODUCTION_CHECKLIST.md)

---

## 🚂 Implementation on Railway

### Step 1: Preparing the project

1. Make sure the code is on the `main` branch
2. Railway will automatically detect `railway.json` and `Dockerfile`

### Step 2: Create a project in Railway

1. Log in to [railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select the 4VELO repository
4. Railway will automatically create a backend service

### Step 3: Database configuration

1. In Railway Dashboard, click **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway will automatically set the `DATABASE_URL` variable
3. Add PostGIS extensions:```bash
railway run psql -c "CREATE EXTENSION IF NOT EXISTS postgis;"
railway run psql -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```### Step 4: Configuring Redis

1. In Railway Dashboard, click **"New"** → **"Database"** → **"Add Redis"**
2. Railway will automatically set the `REDIS_URL` variable

### Step 5: Environment Variables

In Railway → Backend → Variables set:```bash
# Wymagane
SECRET_KEY=<wygenerowany-bezpieczny-klucz>
DEBUG=0
ALLOWED_HOSTS=<twoja-domena>.up.railway.app

# Opcjonalne (integracje)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG....
FROM_EMAIL=no-reply@twojadomena.pl
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
GARMIN_CLIENT_ID=...
GARMIN_CLIENT_SECRET=...
OPENAI_API_KEY=sk-...
SENTRY_DSN=https://...
```### Step 6: Migrations and seed data```bash
# Przez Railway Shell
railway run python manage.py migrate
railway run python manage.py create_admin
railway run python manage.py seed_rbac
railway run python manage.py seed_data
```### Step 7: Implementation of the admin panel

1. In the Railway Dashboard, add a new service
2. Select **"Deploy from GitHub repo"**
3. Set the root directory to `admin/`
4. Railway will use `admin/railway.json`

### Step 8: Worker Celery - Simulate separately

Recommended in production: **two** worker services:

1. **celery-worker** - `critical,default,notifications` queues
2. **celery-worker-simulation** - `simulation` only (batch 300k, live map)

Details: [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md).

### Step 8b: BRouter service (live sim + anti-cheat)

1. New repo site: **Dockerfile** `infrastructure/brouter/Dockerfile`, build context = root repo.
2. Port **17777**, volume **`/brouter/segments4`** (≥ 2 GB).
3. Variables on `celery-worker-simulation` and backend: `BROUTER_URL=http://brouter.railway.internal:17777/brouter`.

Runbook: [operations/BROUTER.md](./operations/BROUTER.md), [infrastructure/brouter/README.md](../../infrastructure/brouter/README.md).

### Step 9: Verification```bash
# Sprawdź health
curl https://<domena>.up.railway.app/api/infra/health/

# Sprawdź API docs
curl https://<domena>.up.railway.app/api/docs/
```---

## 🐳 Docker Compose Production

### Plik: `docker-compose.prod.yml````yaml
version: '3.8'

services:
  backend:
    build: ./backend
    restart: always
    environment:
      DEBUG: 0
      SECRET_KEY: ${SECRET_KEY}
      DATABASE_URL: postgres://${POSTGRES_USER}:${DB_PASSWORD}@db:5432/${POSTGRES_DB}
      REDIS_URL: redis://redis:6379/0
      ALLOWED_HOSTS: ${ALLOWED_HOSTS}
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis
    volumes:
      - static_data:/app/staticfiles

  admin:
    build:
      context: ./admin
      args:
        VITE_API_URL: ${VITE_API_URL}
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend

  db:
    image: timescale/timescaledb-ha:pg15-latest
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data

volumes:
  pgdata:
  redis_data:
  static_data:
```### Activation```bash
# Skopiuj plik konfiguracyjny
cp .env.example .env

# Edytuj .env i ustaw wartości produkcyjne

# Uruchom
docker compose -f docker-compose.prod.yml up -d

# Migracje
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker compose -f docker-compose.prod.yml exec backend python manage.py create_admin
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_rbac
```---

## 🔒 SSL/HTTPS Setup

### Railway (automatic)

Railway automatically provides HTTPS with Let's Encrypt certificates.

### Docker Compose (Nginx + Let's Encrypt)

1. **Add Nginx to docker-compose:**```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
    - ./certs:/etc/nginx/certs
  depends_on:
    - backend
    - admin
```2. **Nginx Configuration (`nginx.conf`):**```nginx
server {
    listen 80;
    server_name sport-platform.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name sport-platform.com;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://admin:80;
        proxy_set_header Host $host;
    }
}
```3. **Certificate generation (Certbot):**```bash
docker run -it --rm \
  -v ./certs:/etc/letsencrypt \
  certbot/certbot certonly \
  --standalone \
  -d sport-platform.com \
  --email admin@sport-platform.com \
  --agree-tos
```---

## 💾 Database backup

### Automatic backup (Railway)

Railway automatically creates backups every 24 hours.

### Manual backup```bash
# Backup przez pg_dump
railway run pg_dump -Fc 4velo_db > backup_$(date +%Y%m%d_%H%M%S).dump

# Backup przez Docker
docker compose exec db pg_dump -U 4velo_user -Fc 4velo_db > backup.dump
```### Restore from backup```bash
# Restore przez pg_restore
railway run pg_restore -d 4velo_db --clean --if-exists backup.dump

# Restore przez Docker
docker compose exec -T db pg_restore -U 4velo_user -d 4velo_db < backup.dump
```### Backup media files```bash
# Backup
docker compose cp backend:/app/media ./backup/media

# Restore
docker compose cp ./backup/media backend:/app/media
```---

## 📊 Monitoring Setup

### Sentry (errors and performance)

1. **Configuration:**```bash
SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```2. **Dashboard:** [sentry.io](https://sentry.io)

### Health Check Endpoints

| Endpoint | Opis |
|----------|------|
| `/api/infra/health/` | Ogólny health check |
| `/api/infra/health/redis/` | Health Redis |
| `/api/infra/health/citus/` | Health bazy |

### Logi```bash
# Railway logs
railway logs

# Docker logs
docker compose logs -f backend
docker compose logs -f admin
docker compose logs -f db
```---

## 🔄 CI/CD Pipeline

### GitHub Actions (optional)```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install Railway CLI
        run: npm i -g @railway/cli
      - name: Deploy
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```---

## ✅ Implementation checklist

### Before implementation

- [ ] Code on the `main` branch
- [ ] Tests pass (`python run_tests.py`)
- [ ] Prepared migrations (`python manage.py makemigrations`)
- [ ] Environment variables set
- [ ] SECRET_KEY generated
- [ ] ALLOWED_HOSTS set

### After implementation

- [ ] Migrations running (`python manage.py migrate`)
- [ ] RBAC seeded (`python manage.py seed_rbac`)
- [ ] Health check OK (`/api/infra/health/`)
- [ ] API docs available (`/api/docs/`)
- [ ] Login works
- [ ] Sentry receives events
- [ ] Backup configured

---

> **See also:** [🔄 Migration Guide](./MIGRATION.md) - migrations and rollback  
> **See also:** [🔍 Troubleshooting](./TROUBLESHOOTING.md) - Troubleshooting
