import os
from datetime import timedelta
from pathlib import Path

from core.sentry import init_sentry

init_sentry()  # Phase 10: Observability


BASE_DIR = Path(__file__).resolve().parent.parent

# SECRET_KEY: prefer explicit env var, auto-generate on Railway/Heroku-like platforms
# when one isn't set, so deploys don't crash.  Logging warns the operator.
_DEFAULT_UNSAFE = "default-unsafe-key-for-dev"
SECRET_KEY = os.getenv("SECRET_KEY", _DEFAULT_UNSAFE)
DEBUG = os.getenv("DEBUG", "0") == "1"
# Never enable DEBUG=1 in production at 300k scale: Django's django.db.backends logger
# can emit full INSERT SQL including password hashes from bulk_create. Use Railway logs only.

if not DEBUG and SECRET_KEY == _DEFAULT_UNSAFE:
    # Railway / Heroku / Render — auto-generate a random key so the app CAN start.
    # This invalidates existing sessions/JWT tokens, but that's acceptable for a
    # one-time deploy.  The operator should set SECRET_KEY explicitly.
    _on_paas = bool(os.getenv("RAILWAY_SERVICE_NAME") or os.getenv("DYNO") or os.getenv("RENDER"))
    if _on_paas:
        import secrets

        SECRET_KEY = secrets.token_urlsafe(50)
        import warnings

        warnings.warn(
            "⚠️  SECRET_KEY auto-generated for this deploy. "
            "Set SECRET_KEY variable in Railway to persist sessions/JWT across restarts."
        )
    else:
        raise RuntimeError(
            "SECRET_KEY must be set in production. Set the SECRET_KEY environment variable."
        )
from core.production_guards import parse_allowed_hosts, warn_insecure_allowed_hosts

ALLOWED_HOSTS = parse_allowed_hosts(os.getenv("ALLOWED_HOSTS"))
warn_insecure_allowed_hosts(ALLOWED_HOSTS, debug=DEBUG)

# Feature Flags — gradual rollout control
DEPARTMENTS_ENABLED = os.getenv("DEPARTMENTS_ENABLED", "1") == "1"

# Security hardening — HTTPS enforcement (disabled in DEBUG for local dev)
# Railway terminates HTTPS at the load balancer — check X-Forwarded-Proto
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = (
    604800 if not DEBUG else 0
)  # 1 week (ramp up to 1 year after confirming stable HTTPS)
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
    "django.contrib.sites",
    "rest_framework",
    "rest_framework_gis",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "users",
    "activities",
    "events",
    "clubs",
    "rewards",
    "core",
    "django_celery_beat",
]

SITE_ID = 1

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middleware.TenantRLSMiddleware",
    "core.middleware.ImpersonationAuditMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

import dj_database_url

_database_url = os.getenv("DATABASE_URL")
if not _database_url:
    raise RuntimeError(
        "DATABASE_URL environment variable is required. "
        "Set it in Railway → Backend service → Variables."
    )

DATABASES = {
    "default": dj_database_url.parse(_database_url, engine="django.contrib.gis.db.backends.postgis")
}
if "sqlite" not in _database_url.lower():
    DATABASES["default"]["CONN_MAX_AGE"] = int(os.getenv("DATABASE_CONN_MAX_AGE", "60"))

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    # {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTH_USER_MODEL = "users.User"

LANGUAGE_CODE = "pl"
TIME_ZONE = "Europe/Warsaw"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

_REST_AUTH_CLASSES = [
    "rest_framework_simplejwt.authentication.JWTAuthentication",
]
if os.getenv("SIM_LAB_ACCEPT_PROXY", "0").lower() in ("1", "true", "yes"):
    _REST_AUTH_CLASSES.insert(0, "users.sim_lab_proxy_auth.SimLabProxyAuthentication")

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": _REST_AUTH_CLASSES,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/minute",
        "user": "300/minute",
        "login": "5/minute",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

ALLAUTH_SITE_ID = 1
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
ACCOUNT_LOGIN_METHODS = {"email", "username"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "username*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = "optional"
import os

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
            "secret": os.getenv("GOOGLE_SECRET", ""),
        },
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
    }
}

# CORS — restricted to known domains (was: CORS_ALLOW_ALL_ORIGINS = True)
_CORS_DEFAULTS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8081",
    "https://sport-admin.vercel.app",
    "https://sport-platform.com",
    "https://admin-production-083b.up.railway.app",
]
_extra_cors = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
_env_origins = []
for _origin_var in ("FRONTEND_URL", "ADMIN_URL"):
    _origin_val = os.getenv(_origin_var, "").strip().rstrip("/")
    if _origin_val.startswith(("http://", "https://")):
        _env_origins.append(_origin_val)
CORS_ALLOWED_ORIGINS = list(dict.fromkeys(_CORS_DEFAULTS + _env_origins + _extra_cors))
CORS_ALLOW_CREDENTIALS = True
_extra_csrf = [o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(CORS_ALLOWED_ORIGINS + _extra_csrf))

# Security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"

SPECTACULAR_SETTINGS = {
    "TITLE": "4VELO API - Global Platform",
    "DESCRIPTION": "High-performance telemetry and competition engine for cities and corporations.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_PATCH": True,
    "COMPONENT_SPLIT_REQUEST": True,
    "SWAGGER_UI_SETTINGS": {
        "deepLinking": True,
        "persistAuthorization": True,
        "displayOperationId": True,
    },
    "LICENSE": {"name": "MIT License"},
    "CONTACT": {"name": "akarn", "url": "https://github.com/akarn"},
}

# Phase 7: Celery — Async Task Queue
# Broker: auto-detects Redis Cluster or standalone from environment
_redis_cluster_nodes = os.getenv("REDIS_CLUSTER_NODES", "")
_redis_password = os.getenv("REDIS_PASSWORD", "")

if _redis_cluster_nodes:
    _celery_broker = f"redis://{_redis_cluster_nodes.split(',')[0]}/1"
else:
    _redis_url = os.getenv("REDIS_URL", "redis://redis:6379/1")
    # Inject REDIS_PASSWORD if set and not already in URL
    if _redis_password and "@" not in _redis_url.split("://", 1)[1]:
        import urllib.parse

        parsed = urllib.parse.urlparse(_redis_url)
        encoded_pw = urllib.parse.quote(_redis_password, safe="")
        _redis_url = parsed._replace(
            netloc=f":{encoded_pw}@{parsed.hostname}:{parsed.port or 6379}"
        ).geturl()
    _celery_broker = _redis_url

CELERY_BROKER_URL = _celery_broker
CELERY_RESULT_BACKEND = _celery_broker
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "Europe/Warsaw"

# Worker reliability (Railway OOM / SIGKILL): ack after task body, requeue on worker loss.
CELERY_TASK_ACKS_LATE = os.getenv("CELERY_TASK_ACKS_LATE", "true").lower() in (
    "1",
    "true",
    "yes",
    "on",
)
CELERY_TASK_REJECT_ON_WORKER_LOST = os.getenv(
    "CELERY_TASK_REJECT_ON_WORKER_LOST",
    "true",
).lower() in ("1", "true", "yes", "on")
CELERY_WORKER_PREFETCH_MULTIPLIER = int(os.getenv("CELERY_WORKER_PREFETCH_MULTIPLIER", "1"))
CELERY_WORKER_MAX_TASKS_PER_CHILD = int(os.getenv("CELERY_MAX_TASKS_PER_CHILD", "200"))

# Force Celery to run synchronously in local/SQLite dev environment if DATABASE_URL is SQLite
if "sqlite" in os.getenv("DATABASE_URL", ""):
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_ALWAYS_EAGER = True
    PASSWORD_HASHERS = [
        "django.contrib.auth.hashers.MD5PasswordHasher",
    ]

# Separate queues: critical (telemetry/BRouter) and notifications (push/email)
CELERY_TASK_ROUTES = {
    "activities.tasks.snapshot_live_positions_to_timescale": {"queue": "default"},
    "activities.tasks.deliver_live_map_webhook": {"queue": "notifications"},
    "activities.tasks.evaluate_live_map_alerts": {"queue": "default"},
    "activities.tasks.monitor_postgres_disk": {"queue": "default"},
    "activities.wipe_tasks.*": {"queue": "default"},
    "activities.tasks.*": {"queue": "critical"},
    "activities.ml_retrain.*": {"queue": "default"},
    "events.tasks.*": {"queue": "critical"},
    "notifications.tasks.*": {"queue": "notifications"},
    # Must precede simulator_tasks.* wildcard (Celery matches most specific route).
    "activities.simulator_tasks.route_live_ride_task": {"queue": "routing"},
    "activities.simulator_tasks.*": {"queue": "simulation"},
}
CELERY_TASK_QUEUE_MAX_PRIORITY = 10

# Celery Beat: Periodic task schedule
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # ML model retraining — every Monday at 03:00 Warsaw
    "ml-model-retrain-weekly": {
        "task": "activities.tasks.retrain_ml_model",
        "schedule": crontab(hour=3, minute=0, day_of_week=1),
        "options": {"queue": "default"},
    },
    # Leaderboard MV refresh — every 5 minutes
    "refresh-city-rankings-mv": {
        "task": "activities.tasks.refresh_city_rankings_mv",
        "schedule": crontab(minute="*/5"),
        "options": {"queue": "default"},
    },
    # Weekly leaderboard digest — every Monday at 09:00
    "weekly-leaderboard-digest": {
        "task": "activities.tasks.send_leaderboard_digest",
        "schedule": crontab(hour=9, minute=0, day_of_week=1),
        "args": ("global", 10),
        "options": {"queue": "notifications"},
    },
    # City leaderboard recalculate — every 15 minutes
    "city-leaderboard-recalculate": {
        "task": "activities.tasks.recalculate_city_leaderboard",
        "schedule": crontab(minute="*/15"),
        "options": {"queue": "default"},
    },
    # Daily event cleanup — every day at 02:00
    "daily-event-cleanup": {
        "task": "events.tasks.close_expired_events",
        "schedule": crontab(hour=2, minute=0),
        "options": {"queue": "default"},
    },
    # Admin dashboard KPI cache — every 4 minutes (TTL 300s)
    "warm-dashboard-stats-cache": {
        "task": "activities.tasks.warm_dashboard_stats_cache",
        "schedule": crontab(minute="*/4"),
        "options": {"queue": "default"},
    },
    # Postgres disk guard — every 5 minutes (simulation safeguards + audit)
    "postgres-disk-monitor": {
        "task": "activities.tasks.monitor_postgres_disk",
        "schedule": crontab(minute="*/5"),
        "options": {"queue": "default"},
    },
    # Live Map Timescale snapshot — warm path writer (Redis → telemetry hypertable)
    "live-map-timescale-snapshot": {
        "task": "activities.tasks.snapshot_live_positions_to_timescale",
        "schedule": 10.0,
        "options": {"queue": "default"},
    },
    # Live Map alert detector — evaluate webhook conditions per tenant
    "live-map-alert-detector": {
        "task": "activities.tasks.evaluate_live_map_alerts",
        "schedule": 60.0,
        "options": {"queue": "default"},
    },
}
