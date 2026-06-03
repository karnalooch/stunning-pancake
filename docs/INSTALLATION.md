# 📦 Instalacja — Przewodnik Instalacji

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Developer onboarding |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Deweloperzy |

Szczegółowa instrukcja instalacji platformy 4VELO w trzech wariantach: lokalny development, Docker Compose i Railway.

**Powiązane:** [operations/BROUTER.md](./operations/BROUTER.md) · [GETTING_STARTED.md](./GETTING_STARTED.md)

---

## 🖥️ Opcja 1: Lokalny Development

### Krok 1: Wymagania systemowe

Upewnij się, że masz zainstalowane:

| Narzędzie | Wersja | Komenda weryfikacyjna |
|-----------|--------|----------------------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| PostgreSQL | 15+ (z PostGIS) | `psql --version` |
| Redis | 7+ | `redis-cli --version` |
| Git | 2.30+ | `git --version` |

### Krok 2: Klonowanie repozytorium

```bash
git clone https://github.com/your-org/4velo.git
cd 4velo
```

### Krok 3: Konfiguracja backendu

```bash
cd backend

# Utwórz wirtualne środowisko
python -m venv venv

# Aktywuj (Windows)
venv\Scripts\activate
# Aktywuj (Linux/macOS)
source venv/bin/activate

# Zainstaluj zależności
pip install -r requirements.txt
```

### Krok 4: Konfiguracja bazy danych

```bash
# Utwórz bazę danych
psql -U postgres
CREATE DATABASE 4velo_db;
CREATE USER 4velo_user WITH PASSWORD 'CHANGE_ME_strong_password';
GRANT ALL PRIVILEGES ON DATABASE 4velo_db TO 4velo_user;
\c 4velo_db
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\q
```

### Krok 5: Konfiguracja środowiska

```bash
# W katalogu głównym projektu
cp .env.example .env

# Edytuj .env i ustaw:
# - SECRET_KEY (wygeneruj bezpieczny klucz)
# - DB_PASSWORD (hasło do bazy)
# - DEBUG=1 (dla developmentu)
```

Generowanie SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

### Krok 6: Migracje i seed data

```bash
cd backend

# Uruchom migracje
python manage.py migrate

# Utwórz administratora
python manage.py create_admin

# Załaduj dane testowe
python manage.py seed_data

# Seed RBAC (system uprawnień)
python manage.py seed_rbac
```

### Krok 7: Uruchomienie backendu

```bash
python manage.py runserver
```

Backend dostępny pod: http://localhost:8000

### Krok 8: Konfiguracja frontendu (Admin Panel)

```bash
cd admin

# Zainstaluj zależności
npm install --legacy-peer-deps

# Uruchom development server
npm run dev
```

Admin Panel dostępny pod: http://localhost:5173

---

## 🐳 Opcja 2: Docker Compose

### Krok 1: Wymagania

| Narzędzie | Wersja |
|-----------|--------|
| Docker | 20.10+ |
| Docker Compose | 2.0+ |

### Krok 2: Konfiguracja

```bash
# Skopiuj plik konfiguracyjny
cp .env.example .env

# Wygeneruj SECRET_KEY
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(50))" >> .env
```

### Krok 3: Uruchomienie

```bash
# Development (wszystkie serwisy)
docker compose up -d

# Lub przez skrypt PowerShell (Windows)
.\dev.ps1
```

### Krok 4: Weryfikacja

```bash
# Sprawdź status kontenerów
docker compose ps

# Sprawdź logi
docker compose logs backend
docker compose logs db
```

### Dostępne serwisy

| Serwis | Port | Opis |
|--------|------|------|
| backend | 8000 | Django REST API |
| global_admin | 3001 | Global Admin Panel |
| tenant_admin | 3002 | Tenant Admin Panel |
| moderator | 3003 | Moderator Panel |
| telemetry | 8001 | FastAPI Telemetry |
| db | 5432 | PostgreSQL + PostGIS |
| redis | 6379 | Redis Cache |
| brouter | 17777 | BRouter (anti-cheat + symulator live) |
| celery_worker_simulation | — | Batch/live sim, kolejka `simulation` |
| traccar | 8082 | Traccar (telemetria) |

### BRouter (Compose)

- Obraz: `infrastructure/brouter/Dockerfile` (BRouter 1.7.9, preset Polska).
- Segmenty: volume `./infrastructure/brouter/segments4` (pierwszy start może pobierać ~1 GB kafelków).
- Worker symulacji: `BROUTER_URL=http://brouter:17777/brouter` (już w `docker-compose.yml`).

Szczegóły: [operations/BROUTER.md](./operations/BROUTER.md), [infrastructure/brouter/README.md](../infrastructure/brouter/README.md).

```bash
# Sprawdzenie routingu (po starcie kontenera)
curl -s "http://localhost:17777/brouter?lonlats=21.01,52.23|21.02,52.24&profile=trekking&format=geojson" | head -c 200
```

### Krok 5: Migracje w Dockerze

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py create_admin
docker compose exec backend python manage.py seed_data
docker compose exec backend python manage.py seed_rbac
```

---

## 🚂 Opcja 3: Railway (Cloud)

### Krok 1: Przygotowanie

1. Zarejestruj się na [railway.app](https://railway.app)
2. Połącz konto GitHub
3. Zainstaluj Railway CLI:

```bash
npm i -g @railway/cli
railway login
```

### Krok 2: Deploy backendu

Backend używa `railway.json` do automatycznej konfiguracji:

```json
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
```

1. W Railway Dashboard kliknij "New Project"
2. Wybierz "Deploy from GitHub repo"
3. Railway automatycznie wykryje `railway.json`

### Krok 3: Konfiguracja zmiennych

W Railway → Backend → Variables dodaj:

```
SECRET_KEY=<wygenerowany-klucz>
DEBUG=0
ALLOWED_HOSTS=<twoja-domena>.up.railway.app
```

Railway automatycznie dostarcza:
- `DATABASE_URL` (PostgreSQL)
- `REDIS_URL` (Redis)

### Krok 4: Migracje

```bash
# Przez Railway Shell
railway run python manage.py migrate
railway run python manage.py create_admin
railway run python manage.py seed_data
railway run python manage.py seed_rbac
```

### Krok 5: Deploy admin panelu

1. W Railway Dashboard dodaj nową usługę
2. Wybierz "Deploy from GitHub repo"
3. Wskaż katalog `admin/`
4. Railway użyje `admin/railway.json`

---

## 📋 Referencja zmiennych środowiskowych

### Baza danych

| Zmienna | Wymagana | Domyślna | Opis |
|---------|----------|----------|------|
| `POSTGRES_DB` | ✅ | `4velo_db` | Nazwa bazy danych |
| `POSTGRES_USER` | ✅ | `4velo_user` | Nazwa użytkownika bazy |
| `DB_PASSWORD` | ✅ | — | Hasło do bazy danych |
| `DATABASE_URL` | ⚠️ | — | Pełny URL bazy (Railway) |

### Django

| Zmienna | Wymagana | Domyślna | Opis |
|---------|----------|----------|------|
| `SECRET_KEY` | ✅ | — | Klucz sesji/JWT |
| `DEBUG` | ✅ | `0` | Tryb debugowania (1=on, 0=off) |
| `ALLOWED_HOSTS` | ⚠️ | `*` | Dozwolone hosty (oddzielone przecinkami) |

### Redis

| Zmienna | Wymagana | Domyślna | Opis |
|---------|----------|----------|------|
| `REDIS_URL` | ✅ | `redis://redis:6379/0` | URL do Redis |
| `REDIS_CLUSTER_NODES` | ❌ | — | Node'y klastra Redis |

### Anti-Cheat

| Zmienna | Domyślna | Opis |
|---------|----------|------|
| `GATE_TELEPORT_M` | 500 | Max skok GPS (metry) |
| `GATE_MAX_ACCEL` | 6.0 | Max przyspieszenie (m/s²) |
| `GATE_MOTOR_VAR` | 0.05 | Max σ/μ motor fingerprint |
| `GATE_STRAIGHT_RATIO` | 0.92 | Min ratio prostej do trasy |
| `GATE_MOTOR_MIN_SEG` | 15 | Min segmentów dla motor check |
| `VMAX_ANOMALY_RATIO` | 0.20 | Max ratio anomalii |
| `VMAX_CONSECUTIVE` | 3 | Max kolejnych naruszeń |
| `VMAX_MARGIN` | 1.10 | Margines prędkości |

### Integracje zewnętrzne

| Zmienna | Opis |
|---------|------|
| `STRIPE_SECRET_KEY` | Klucz API Stripe (płatności) |
| `STRIPE_WEBHOOK_SECRET` | Secret webhooka Stripe |
| `SENDGRID_API_KEY` | Klucz API SendGrid (emaile) |
| `FROM_EMAIL` | Adres nadawcy emaili |
| `FROM_NAME` | Nazwa nadawcy emaili |
| `STRAVA_CLIENT_ID` | Client ID Strava OAuth |
| `STRAVA_CLIENT_SECRET` | Client Secret Strava OAuth |
| `STRAVA_REDIRECT_URI` | Redirect URI Strava |
| `GARMIN_CLIENT_ID` | Client ID Garmin OAuth |
| `GARMIN_CLIENT_SECRET` | Client Secret Garmin OAuth |
| `GARMIN_REDIRECT_URI` | Redirect URI Garmin |
| `OPENAI_API_KEY` | Klucz API OpenAI (LLM coaching) |
| `GOOGLE_API_KEY` | Klucz API Google (generowanie obrazów) |
| `SENTRY_DSN` | DSN Sentry (monitoring) |
| `SENTRY_ENVIRONMENT` | Środowisko Sentry (production/staging) |

---

## 🗄️ Setup bazy danych

### PostgreSQL + PostGIS

Platforma wymaga PostgreSQL z rozszerzeniami:

```sql
-- Utwórz rozszerzenia
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS hstore;
```

### Row Level Security (RLS)

RLS jest włączane automatycznie przez migracje:

```bash
python manage.py migrate
python apply_rls.py  # Ręczne zastosowanie polityk RLS
```

---

## 🔄 Uruchamianie migracji

```bash
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
```

---

## 🌱 Seedowanie danych

### Dane testowe

```bash
# Seedowanie danych testowych (użytkownicy, tenanci, aktywności)
python manage.py seed_data

# Seedowanie z czyszczeniem istniejących danych
python manage.py seed_data --clear
```

### Seedowanie RBAC

```bash
# Seedowanie systemu RBAC (role, permissions, assignments)
python manage.py seed_rbac
```

### Naprawa hasła admina

```bash
# Reset hasła administratora
python manage.py fix_admin_password
```

---

## ✅ Weryfikacja instalacji

### Backend

```bash
# Sprawdź health endpoint
curl http://localhost:8000/api/infra/health/

# Sprawdź API docs
curl http://localhost:8000/api/docs/

# Uruchom testy
cd backend
python run_tests.py
```

### Frontend

```bash
# Otwórz w przeglądarce
http://localhost:5173

# Lub uruchom testy E2E
cd admin
npm run test:e2e
```

---

> **Następny krok:** [⚙️ Configuration Guide](./CONFIGURATION.md)
