# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../CONFIGURATION.md) |
| **canonical_path** | docs/en/CONFIGURATION.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Backend Lead |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Developers, Platform Operator |

Complete 4VELO platform setup guide - environment variables, Django settings, Celery, Redis, PostGIS and external integrations.

**SSOT production caps:** [operations/RAILWAY_CELERY_MEMORY.md](./operations/RAILWAY_CELERY_MEMORY.md) - do not duplicate full `SCALE_*` tables here.

---

## 📋 Overview of environment variables

All environment variables are located in the `.env` file (or set in the Railway panel). The full list is in [`.env.example`](../../.env.example).

Special sections in `.env.example`:

- **Scale / load test** - `SCALE_*` (see also [operations/SIMULATOR.md](./operations/SIMULATOR.md))
- **BRouter** - `BROUTER_URL`, `BROUTER_TIMEOUT`

---

## 🔧 Django Settings

### Configuration file: [`backend/core/settings.py`](../../backend/core/settings.py)

### Key settings

| Setting | Value | Description |
|------------|---------|------|
| `SECRET_KEY` | Env var | Cryptographic key for session and JWT |
| `DEBUG` | `0` or `1` | Debug mode (disabled in production) |
| `ALLOWED_HOSTS` | `*` or list | Allowed hosts for requests |
| `SECURE_SSL_REDIRECT` | `not DEBUG` | Force HTTPS |
| `SECURE_HSTS_SECONDS` | `604800` | HSTS max-age (1 week) |
| `SESSION_COOKIE_SECURE` | `not DEBUG` | Secure flag for session cookies |
| `CSRF_COOKIE_SECURE` | `not DEBUG` | Secure flag for CSRF cookies |

### Security hardening```python
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
```### Installed applications```python
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
```### Middleware```python
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
```---

## 🔐 JWT authorization

### SimpleJWT configuration```python
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
```### JWT endpoints

| Endpoint | Method | Description |
|----------|--------|------|
| `/api/auth/token/` | POST | Obtaining a token (access + refresh) |
| `/api/auth/token/refresh/` | POST | Refreshing the access token |
| `/api/auth/token/verify/` | POST | Token verification |

---

## 🔄 Celery Configuration

### Configuration```python
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
```### Starting workers```bash
# Worker Celery
celery -A core worker -l info -Q critical,notifications

# Beat scheduler
celery -A core beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```### Docker Compose```yaml
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
```---

## 🔴 Redis Configuration

### Redis usage

| Function | Description |
|---------|------|
| Celery Broker | Asynchronous task queue |
| Cache | API response caching |
| Leaderboard | Sorted Sets for Rankings |
| Sessions | Session backend (optional) |
| Telemetry | GPS position caching |

### Configuration```bash
# URL do Redis
REDIS_URL=redis://redis:6379/0

# Opcjonalnie: klaster Redis
REDIS_CLUSTER_NODES=redis-node-1:6379,redis-node-2:6379,redis-node-3:6379
```### Leaderboard (Sorted Sets)```python
# Klucz leaderboardu
LEADERBOARD_KEY = f"leaderboard:{city_id}"

# TTL cache (sekundy)
LEADERBOARD_CACHE_TTL=30
```---

## 🗺️ PostGIS Configuration

### Required extensions```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS hstore;
```### Django configuration```python
# GIS libraries
INSTALLED_APPS += ['django.contrib.gis']

# Spatial backend
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        ...
    }
}
```### GDAL/GEOS environment variables```bash
# Docker automatycznie ustawia te ścieżki
GDAL_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu/libgdal.so
GEOS_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu/libgeos_c.so
```---

## 💳 Stripe Integration

### Configuration```bash
# Klucz API Stripe (płatności)
STRIPE_SECRET_KEY=sk_test_...

# Webhook secret (weryfikacja zdarzeń)
STRIPE_WEBHOOK_SECRET=whsec_...
```### Stripe Endpoints

| Endpoint | Method | Description |
|----------|--------|------|
| `/api/activities/payments/checkout/` | POST | Creating a checkout session |
| `/api/activities/payments/webhook/` | POST | Stripe webhook (events) |

### Payouts for sponsors```python
# Tenant - konto Stripe Connect
stripe_account_id = models.CharField(max_length=100, null=True, blank=True)

# User - konto Stripe Connect
stripe_connect_id = models.CharField(max_length=100, null=True, blank=True)
```---

## 📧 Email (SendGrid) Setup

### Configuration```bash
# Klucz API SendGrid
SENDGRID_API_KEY=SG.xxxx...

# Adres nadawcy
FROM_EMAIL=no-reply@4velo.app
FROM_NAME=4VELO Platform
```### Usage```python
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
```---

## 🔗 OAuth (Strava, Garmin) Setup

### Strava OAuth

1. Register the app on [strava.com/settings/api](https://www.strava.com/settings/api)
2. Copy the Client ID and Client Secret
3. Set the redirect URI```bash
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=abcdef...
STRAVA_REDIRECT_URI=https://sport-platform.com/api/activities/wearables/strava/callback/
```### Garmin OAuth

1. Register the application at [developer.garmin.com](https://developer.garmin.com)
2. Copy Consumer Key and Consumer Secret
3. Set up a callback URL```bash
GARMIN_CLIENT_ID=your-consumer-key
GARMIN_CLIENT_SECRET=your-consumer-secret
GARMIN_REDIRECT_URI=https://sport-platform.com/api/activities/wearables/garmin/callback/
```### Endpointy OAuth

| Endpoint | Opis |
|----------|------|
| `/api/activities/wearables/strava/auth/` | URL autoryzacji Strava |
| `/api/activities/wearables/strava/callback/` | Callback Strava |
| `/api/activities/wearables/garmin/auth/` | URL autoryzacji Garmin |
| `/api/activities/wearables/garmin/callback/` | Callback Garmin |
| `/api/activities/wearables/sync/` | Manualna synchronizacja |

---

## 🔍 Sentry Monitoring

### Konfiguracja```bash
# DSN Sentry (monitoring błędów)
SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz

# Środowisko
SENTRY_ENVIRONMENT=production

# Sample rate dla tracingu
SENTRY_TRACES_SAMPLE_RATE=0.1
```### Initialization```python
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
```---

## 🤖 LLM (AI Coaching) Configuration

### Configuration```bash
# Klucz API OpenAI (lub kompatybilny)
OPENAI_API_KEY=sk-...

# Opcjonalnie: endpoint API LLM
LLM_API_URL=https://api.openai.com/v1

# Opcjonalnie: model LLM
LLM_MODEL=gpt-4o-mini

# Timeout (ms)
LLM_TIMEOUT_MS=5000
```### Usage

- **Mobile Coach**: `gpt-4o-mini` (low latency <500ms P95)
- **Admin System Intelligence**: `gpt-4o` (deeper analysis)

---

## 🌐 CORS Configuration

### Settings```python
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
CORS_ALLOW_HEADERS = ['Authorization', 'Content-Type', 'Accept']
```### Environment variable```bash
CORS_ALLOWED_ORIGINS=http://localhost:3001,http://localhost:5173,https://sport-platform.com
```---

## 📊 Additional variables

### Reward system

| Variable | Default | Description |
|---------|----------|------|
| `REWARDS_POINTS_PER_KM` | 10 | Points per kilometer |

### Privacy Zones

| Variable | Default | Description |
|---------|----------|------|
| `PRIVACY_DENSITY_BOOST_THRESHOLD` | 3 | Threshold for density boost |
| `PRIVACY_DENSITY_BOOST_FACTOR` | 1.5 | Density boost factor |

### ML Anti-Cheat

| Variable | Default | Description |
|---------|----------|------|
| `ML_MODEL_PATH` | `/app/models/anomaly_detector.pkl` | ML Model Path |
| `ML_ANOMALY_THRESHOLD` | -0.15 | Anomaly Threshold |

### RLS / Citus

| Variable | Default | Description |
|---------|----------|------|
| `RLS_APP_ROLE` | `4velo_app` | Application role for RLS |
| `CITUS_SHARD_COUNT` | 32 | Number of Citus shards |

### Scale simulation and BRouter

Full operations table: [operations/SIMULATOR.md](./operations/SIMULATOR.md). Code: [`backend/activities/scale_config.py`](../../backend/activities/scale_config.py).

| Variable | Where to set | Description |
|---------|---------------|------|
| `BROUTER_URL` | backend, celery-worker-simulation | E.g. `http://brouter.railway.internal:17777/brouter` |
| `SCALE_POSTGRES_DISK_BUDGET_GB` | backend, celery-worker-simulation | Postgres Volume Budget (Railway often 5) |
| `SCALE_SIM_STRICT_ROAD_ROUTES` | celery-worker-simulation | `1` = only routes from BRouter |
| `CELERY_WORKER_QUEUES` | celery-worker-simulation | `simulation` |

---

> **Next step:** [🛡️ RBAC Guide](./RBAC.md)  
> **Operations:** [operations/](./operations/)
