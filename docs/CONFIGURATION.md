# ⚙️ Konfiguracja — Przewodnik Konfiguracyjny

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Backend Lead |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Deweloperzy, Platform Operator |

Kompletny przewodnik konfiguracji platformy 4VELO — zmienne środowiskowe, ustawienia Django, Celery, Redis, PostGIS i integracje zewnętrzne.

**SSOT caps produkcji:** [operations/RAILWAY_CELERY_MEMORY.md](./operations/RAILWAY_CELERY_MEMORY.md) — nie duplikuj pełnych tabel `SCALE_*` tutaj.

---

## 📋 Przegląd zmiennych środowiskowych

Wszystkie zmienne środowiskowe znajdują się w pliku `.env` (lub są ustawiane w panelu Railway). Pełna lista znajduje się w [`.env.example`](../.env.example).

Sekcje specjalne w `.env.example`:

- **Scale / load test** — `SCALE_*` (patrz też [operations/SIMULATOR.md](./operations/SIMULATOR.md))
- **BRouter** — `BROUTER_URL`, `BROUTER_TIMEOUT`

---

## 🔧 Ustawienia Django

### Plik konfiguracyjny: [`backend/core/settings.py`](../backend/core/settings.py)

### Kluczowe ustawienia

| Ustawienie | Wartość | Opis |
|------------|---------|------|
| `SECRET_KEY` | Env var | Klucz kryptograficzny dla sesji i JWT |
| `DEBUG` | `0` lub `1` | Tryb debugowania (wyłączony na produkcji) |
| `ALLOWED_HOSTS` | `*` lub lista | Dozwolone hosty dla requestów |
| `SECURE_SSL_REDIRECT` | `not DEBUG` | Wymuszenie HTTPS |
| `SECURE_HSTS_SECONDS` | `604800` | HSTS max-age (1 tydzień) |
| `SESSION_COOKIE_SECURE` | `not DEBUG` | Secure flag dla ciasteczek sesji |
| `CSRF_COOKIE_SECURE` | `not DEBUG` | Secure flag dla ciasteczek CSRF |

### Security hardening

```python
# Wymuszenie HTTPS (wyłączone w DEBUG)
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 604800  # 1 tydzień
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'

# Proxy SSL (Railway terminates HTTPS)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

### Zainstalowane aplikacje

```python
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',           # PostGIS
    'django.contrib.sites',         # django-allauth
    'rest_framework',               # DRF
    'rest_framework_gis',           # DRF GIS
    'rest_framework_simplejwt',     # JWT Auth
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',                  # CORS
    'drf_spectacular',              # OpenAPI Schema
    'allauth',                      # Social Auth
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'users',                        # Apps
    'activities',
    'events',
    'clubs',
    'rewards',
    'core',
    'django_celery_beat',           # Celery scheduler
]
```

### Middleware

```python
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Static files
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.TenantRLSMiddleware',          # RLS isolation
    'core.middleware.ImpersonationAuditMiddleware', # Audit logging
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]
```

---

## 🔐 Autoryzacja JWT

### Konfiguracja SimpleJWT

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}
```

### Endpointy JWT

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/auth/token/` | POST | Uzyskanie tokena (access + refresh) |
| `/api/auth/token/refresh/` | POST | Odświeżenie tokena access |
| `/api/auth/token/verify/` | POST | Weryfikacja tokena |

---

## 🔄 Celery Configuration

### Konfiguracja

```python
# Celery Broker
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://redis:6379/0')

# Serializacja
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# Timezone
CELERY_TIMEZONE = 'UTC'
CELERY_ENABLE_UTC = True

# Task routing
CELERY_TASK_ROUTES = {
    'activities.tasks.*': {'queue': 'celery'},
}

# Beat scheduler (okresowe zadania)
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
```

### Uruchamianie workerów

```bash
# Worker Celery
celery -A core worker -l info -Q critical,notifications

# Beat scheduler
celery -A core beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

### Docker Compose

```yaml
# Celery Worker
celery_worker:
  build: ./backend
  command: celery -A core worker -l info -Q critical,notifications
  environment:
    DATABASE_URL: postgres://...
    REDIS_URL: redis://redis:6379/0
  depends_on:
    - db
    - redis

# Celery Beat
celery_beat:
  build: ./backend
  command: celery -A core beat -l info
  environment:
    DATABASE_URL: postgres://...
    REDIS_URL: redis://redis:6379/0
  depends_on:
    - db
    - redis
```

---

## 🔴 Redis Configuration

### Użycie Redis

| Funkcja | Opis |
|---------|------|
| Celery Broker | Kolejka zadań asynchronicznych |
| Cache | Cacheowanie odpowiedzi API |
| Leaderboard | Sorted Sets dla rankingów |
| Sessions | Backend dla sesji (opcjonalnie) |
| Telemetry | Buforowanie pozycji GPS |

### Konfiguracja

```bash
# URL do Redis
REDIS_URL=redis://redis:6379/0

# Opcjonalnie: klaster Redis
REDIS_CLUSTER_NODES=redis-node-1:6379,redis-node-2:6379,redis-node-3:6379
```

### Leaderboard (Sorted Sets)

```python
# Klucz leaderboardu
LEADERBOARD_KEY = f"leaderboard:{city_id}"

# TTL cache (sekundy)
LEADERBOARD_CACHE_TTL=30
```

---

## 🗺️ PostGIS Configuration

### Wymagane rozszerzenia

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS hstore;
```

### Konfiguracja Django

```python
# GIS libraries
INSTALLED_APPS += ['django.contrib.gis']

# Spatial backend
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        ...
    }
}
```

### Zmienne środowiskowe GDAL/GEOS

```bash
# Docker automatycznie ustawia te ścieżki
GDAL_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu/libgdal.so
GEOS_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu/libgeos_c.so
```

---

## 💳 Stripe Integration

### Konfiguracja

```bash
# Klucz API Stripe (płatności)
STRIPE_SECRET_KEY=sk_test_...

# Webhook secret (weryfikacja zdarzeń)
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Endpointy Stripe

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/activities/payments/checkout/` | POST | Utworzenie sesji checkout |
| `/api/activities/payments/webhook/` | POST | Webhook Stripe (eventy) |

### Payouts dla sponsorów

```python
# Tenant - konto Stripe Connect
stripe_account_id = models.CharField(max_length=100, null=True, blank=True)

# User - konto Stripe Connect
stripe_connect_id = models.CharField(max_length=100, null=True, blank=True)
```

---

## 📧 Email (SendGrid) Setup

### Konfiguracja

```bash
# Klucz API SendGrid
SENDGRID_API_KEY=SG.xxxx...

# Adres nadawcy
FROM_EMAIL=no-reply@4velo.app
FROM_NAME=4VELO Platform
```

### Użycie

```python
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))

message = Mail(
    from_email=os.getenv('FROM_EMAIL'),
    to_emails=user.email,
    subject='Welcome to 4VELO!',
    html_content='<h1>Welcome!</h1>'
)
sg.send(message)
```

---

## 🔗 OAuth (Strava, Garmin) Setup

### Strava OAuth

1. Zarejestruj aplikację na [strava.com/settings/api](https://www.strava.com/settings/api)
2. Skopiuj Client ID i Client Secret
3. Ustaw redirect URI

```bash
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=abcdef...
STRAVA_REDIRECT_URI=https://sport-platform.com/api/activities/wearables/strava/callback/
```

### Garmin OAuth

1. Zarejestruj aplikację na [developer.garmin.com](https://developer.garmin.com)
2. Skopiuj Consumer Key i Consumer Secret
3. Ustaw callback URL

```bash
GARMIN_CLIENT_ID=your-consumer-key
GARMIN_CLIENT_SECRET=your-consumer-secret
GARMIN_REDIRECT_URI=https://sport-platform.com/api/activities/wearables/garmin/callback/
```

### Endpointy OAuth

| Endpoint | Opis |
|----------|------|
| `/api/activities/wearables/strava/auth/` | URL autoryzacji Strava |
| `/api/activities/wearables/strava/callback/` | Callback Strava |
| `/api/activities/wearables/garmin/auth/` | URL autoryzacji Garmin |
| `/api/activities/wearables/garmin/callback/` | Callback Garmin |
| `/api/activities/wearables/sync/` | Manualna synchronizacja |

---

## 🔍 Sentry Monitoring

### Konfiguracja

```bash
# DSN Sentry (monitoring błędów)
SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz

# Środowisko
SENTRY_ENVIRONMENT=production

# Sample rate dla tracingu
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Inicjalizacja

```python
# backend/core/sentry.py
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

def init_sentry():
    sentry_sdk.init(
        dsn=os.getenv('SENTRY_DSN'),
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
        ],
        environment=os.getenv('SENTRY_ENVIRONMENT', 'production'),
        traces_sample_rate=float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
        send_default_pii=True,
    )
```

---

## 🤖 LLM (AI Coaching) Configuration

### Konfiguracja

```bash
# Klucz API OpenAI (lub kompatybilny)
OPENAI_API_KEY=sk-...

# Opcjonalnie: endpoint API LLM
LLM_API_URL=https://api.openai.com/v1

# Opcjonalnie: model LLM
LLM_MODEL=gpt-4o-mini

# Timeout (ms)
LLM_TIMEOUT_MS=5000
```

### Użycie

- **Mobile Coach**: `gpt-4o-mini` (niskie opóźnienia <500ms P95)
- **Admin System Intelligence**: `gpt-4o` (głębsza analiza)

---

## 🌐 CORS Configuration

### Ustawienia

```python
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
CORS_ALLOW_HEADERS = ['Authorization', 'Content-Type', 'Accept']
```

### Zmienna środowiskowa

```bash
CORS_ALLOWED_ORIGINS=http://localhost:3001,http://localhost:5173,https://sport-platform.com
```

---

## 📊 Dodatkowe zmienne

### System nagród

| Zmienna | Domyślna | Opis |
|---------|----------|------|
| `REWARDS_POINTS_PER_KM` | 10 | Punkty za kilometr |

### Privacy Zones

| Zmienna | Domyślna | Opis |
|---------|----------|------|
| `PRIVACY_DENSITY_BOOST_THRESHOLD` | 3 | Threshold dla boostu gęstości |
| `PRIVACY_DENSITY_BOOST_FACTOR` | 1.5 | Faktor boostu gęstości |

### ML Anti-Cheat

| Zmienna | Domyślna | Opis |
|---------|----------|------|
| `ML_MODEL_PATH` | `/app/models/anomaly_detector.pkl` | Ścieżka modelu ML |
| `ML_ANOMALY_THRESHOLD` | -0.15 | Threshold anomalii |

### RLS / Citus

| Zmienna | Domyślna | Opis |
|---------|----------|------|
| `RLS_APP_ROLE` | `4velo_app` | Rola aplikacji dla RLS |
| `CITUS_SHARD_COUNT` | 32 | Liczba shardów Citus |

### Symulacja skali i BRouter

Pełna tabela operacyjna: [operations/SIMULATOR.md](./operations/SIMULATOR.md). Kod: [`backend/activities/scale_config.py`](../backend/activities/scale_config.py).

| Zmienna | Gdzie ustawić | Opis |
|---------|---------------|------|
| `BROUTER_URL` | backend, celery-worker-simulation | Np. `http://brouter.railway.internal:17777/brouter` |
| `SCALE_POSTGRES_DISK_BUDGET_GB` | backend, celery-worker-simulation | Budżet wolumenu Postgres (Railway często 5) |
| `SCALE_SIM_STRICT_ROAD_ROUTES` | celery-worker-simulation | `1` = tylko trasy z BRouter |
| `CELERY_WORKER_QUEUES` | celery-worker-simulation | `simulation` |

---

> **Następny krok:** [🛡️ RBAC Guide](./RBAC.md)  
> **Operacje:** [operations/](./operations/)
