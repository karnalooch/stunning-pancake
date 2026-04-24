import os
from datetime import timedelta
from pathlib import Path
from core.sentry import init_sentry
init_sentry()  # Phase 10: Observability



BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'default-unsafe-key-for-dev')
DEBUG = os.getenv('DEBUG', '0') == '1'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '*').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',
    'django.contrib.sites',
    'rest_framework',
    'rest_framework_gis',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'drf_spectacular',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'users',
    'activities',
    'events',
    'clubs',
    'rewards',
]

SITE_ID = 1

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'sport_db',
        'USER': 'sport_user',
        'PASSWORD': 'sport_secure_pass_42a8b9f',
        'HOST': 'db',
        'PORT': '5432',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'users.User'

LANGUAGE_CODE = 'pl'
TIME_ZONE = 'Europe/Warsaw'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

ALLAUTH_SITE_ID = 1
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_AUTHENTICATION_METHOD = 'email'
ACCOUNT_EMAIL_VERIFICATION = 'optional'
SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'SCOPE': ['profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'},
    }
}

CORS_ALLOW_ALL_ORIGINS = True

SPECTACULAR_SETTINGS = {
    'TITLE': 'SPORT API - Global Platform',
    'DESCRIPTION': 'High-performance telemetry and competition engine for cities and corporations.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_PATCH': True,
    'COMPONENT_SPLIT_REQUEST': True,
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'persistAuthorization': True,
        'displayOperationId': True,
    },
    'LICENSE': {'name': 'MIT License'},
    'CONTACT': {'name': 'akarn', 'url': 'https://github.com/akarn'},
}

# Phase 7: Celery — Async Task Queue
# Broker: auto-detects Redis Cluster or standalone from environment
_redis_cluster_nodes = os.getenv('REDIS_CLUSTER_NODES', '')
_celery_broker = (
    f"redis://{_redis_cluster_nodes.split(',')[0]}/1"
    if _redis_cluster_nodes
    else os.getenv('REDIS_URL', 'redis://redis:6379/1')
)
CELERY_BROKER_URL = _celery_broker
CELERY_RESULT_BACKEND = _celery_broker
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Europe/Warsaw'

# Separate queues: critical (telemetry/BRouter) and notifications (push/email)
CELERY_TASK_ROUTES = {
    'activities.tasks.*': {'queue': 'critical'},
    'activities.ml_retrain.*': {'queue': 'default'},
    'events.tasks.*': {'queue': 'critical'},
    'notifications.tasks.*': {'queue': 'notifications'},
}
CELERY_TASK_QUEUE_MAX_PRIORITY = 10

# Celery Beat: Periodic task schedule
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # ML model retraining — every Monday at 03:00 Warsaw (lowest load window)
    'ml-model-retrain-weekly': {
        'task': 'activities.tasks.retrain_ml_model',
        'schedule': crontab(hour=3, minute=0, day_of_week=1),
        'options': {'queue': 'default'},
    },
    # Leaderboard MV refresh — every 5 minutes
    'refresh-city-rankings-mv': {
        'task': 'activities.tasks.refresh_city_rankings_mv',
        'schedule': crontab(minute='*/5'),
        'options': {'queue': 'default'},
    },
}
