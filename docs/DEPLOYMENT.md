# 🌐 Deployment — Przewodnik Wdrożeniowy

Kompletny przewodnik wdrożenia platformy 4VELO na środowisko produkcyjne — Railway, Docker Compose, SSL, backupy i monitoring.

---

## 🚂 Wdrożenie na Railway

### Krok 1: Przygotowanie projektu

1. Upewnij się, że kod jest na branchu `main`
2. Railway automatycznie wykryje `railway.json` i `Dockerfile`

### Krok 2: Utworzenie projektu w Railway

1. Zaloguj się na [railway.app](https://railway.app)
2. Kliknij **"New Project"** → **"Deploy from GitHub repo"**
3. Wybierz repozytorium 4VELO
4. Railway automatycznie stworzy usługę backendu

### Krok 3: Konfiguracja bazy danych

1. W Railway Dashboard kliknij **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway automatycznie ustawi zmienną `DATABASE_URL`
3. Dodaj rozszerzenia PostGIS:

```bash
railway run psql -c "CREATE EXTENSION IF NOT EXISTS postgis;"
railway run psql -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### Krok 4: Konfiguracja Redis

1. W Railway Dashboard kliknij **"New"** → **"Database"** → **"Add Redis"**
2. Railway automatycznie ustawi zmienną `REDIS_URL`

### Krok 5: Zmienne środowiskowe

W Railway → Backend → Variables ustaw:

```bash
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
```

### Krok 6: Migracje i seed data

```bash
# Przez Railway Shell
railway run python manage.py migrate
railway run python manage.py create_admin
railway run python manage.py seed_rbac
railway run python manage.py seed_data
```

### Krok 7: Wdrożenie admin panelu

1. W Railway Dashboard dodaj nową usługę
2. Wybierz **"Deploy from GitHub repo"**
3. Ustaw root directory na `admin/`
4. Railway użyje `admin/railway.json`

### Krok 8: Worker Celery — symulacja oddzielnie

Zalecane na produkcji: **dwa** serwisy workerów:

1. **celery-worker** — kolejki `critical,default,notifications`
2. **celery-worker-simulation** — tylko `simulation` (batch 300k, live map)

Szczegóły: [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md).

### Krok 9: Weryfikacja

```bash
# Sprawdź health
curl https://<domena>.up.railway.app/api/infra/health/

# Sprawdź API docs
curl https://<domena>.up.railway.app/api/docs/
```

---

## 🐳 Docker Compose Production

### Plik: `docker-compose.prod.yml`

```yaml
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
```

### Uruchomienie

```bash
# Skopiuj plik konfiguracyjny
cp .env.example .env

# Edytuj .env i ustaw wartości produkcyjne

# Uruchom
docker compose -f docker-compose.prod.yml up -d

# Migracje
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker compose -f docker-compose.prod.yml exec backend python manage.py create_admin
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_rbac
```

---

## 🔒 SSL/HTTPS Setup

### Railway (automatyczny)

Railway automatycznie zapewnia HTTPS z certyfikatami Let's Encrypt.

### Docker Compose (Nginx + Let's Encrypt)

1. **Dodaj Nginx do docker-compose:**

```yaml
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
```

2. **Konfiguracja Nginx (`nginx.conf`):**

```nginx
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
```

3. **Generowanie certyfikatów (Certbot):**

```bash
docker run -it --rm \
  -v ./certs:/etc/letsencrypt \
  certbot/certbot certonly \
  --standalone \
  -d sport-platform.com \
  --email admin@sport-platform.com \
  --agree-tos
```

---

## 💾 Backup bazy danych

### Automatyczny backup (Railway)

Railway automatycznie tworzy backupy co 24h.

### Ręczny backup

```bash
# Backup przez pg_dump
railway run pg_dump -Fc 4velo_db > backup_$(date +%Y%m%d_%H%M%S).dump

# Backup przez Docker
docker compose exec db pg_dump -U 4velo_user -Fc 4velo_db > backup.dump
```

### Restore z backupu

```bash
# Restore przez pg_restore
railway run pg_restore -d 4velo_db --clean --if-exists backup.dump

# Restore przez Docker
docker compose exec -T db pg_restore -U 4velo_user -d 4velo_db < backup.dump
```

### Backup plików media

```bash
# Backup
docker compose cp backend:/app/media ./backup/media

# Restore
docker compose cp ./backup/media backend:/app/media
```

---

## 📊 Monitoring Setup

### Sentry (błędy i wydajność)

1. **Konfiguracja:**

```bash
SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

2. **Dashboard:** [sentry.io](https://sentry.io)

### Health Check Endpoints

| Endpoint | Opis |
|----------|------|
| `/api/infra/health/` | Ogólny health check |
| `/api/infra/health/redis/` | Health Redis |
| `/api/infra/health/citus/` | Health bazy |

### Logi

```bash
# Railway logs
railway logs

# Docker logs
docker compose logs -f backend
docker compose logs -f admin
docker compose logs -f db
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions (opcjonalnie)

```yaml
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
```

---

## ✅ Checklist wdrożeniowa

### Przed wdrożeniem

- [ ] Kod na branchu `main`
- [ ] Testy przechodzą (`python run_tests.py`)
- [ ] Migracje przygotowane (`python manage.py makemigrations`)
- [ ] Zmienne środowiskowe ustawione
- [ ] SECRET_KEY wygenerowany
- [ ] ALLOWED_HOSTS ustawiony

### Po wdrożeniu

- [ ] Migracje uruchomione (`python manage.py migrate`)
- [ ] RBAC zseedowany (`python manage.py seed_rbac`)
- [ ] Health check OK (`/api/infra/health/`)
- [ ] API docs dostępne (`/api/docs/`)
- [ ] Logowanie działa
- [ ] Sentry otrzymuje eventy
- [ ] Backup skonfigurowany

---

> **Zobacz także:** [🔄 Migration Guide](./MIGRATION.md) — migracje i rollback  
> **Zobacz także:** [🔍 Troubleshooting](./TROUBLESHOOTING.md) — rozwiązywanie problemów
