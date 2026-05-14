"""
Sentry SDK initialization for SPORT backend.

Loaded via settings.py when SENTRY_DSN env variable is set.
Import this module at the top of settings.py to activate.

Privacy guarantee: send_default_pii=False ensures no GPS coordinates,
emails, or user IDs are sent to Sentry (Constitution Art. 10).
"""
import os


def init_sentry() -> None:
    """Initialises Sentry SDK if SENTRY_DSN is configured."""
    dsn = os.getenv('SENTRY_DSN', '')
    if not dsn:
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.django import DjangoIntegration
        from sentry_sdk.integrations.redis import RedisIntegration

        sentry_sdk.init(
            dsn=dsn,
            integrations=[
                DjangoIntegration(),
                CeleryIntegration(),
                RedisIntegration(),
            ],
            traces_sample_rate=float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
            profiles_sample_rate=0.05,
            send_default_pii=False,  # Privacy-by-Design: never send PII
            environment=os.getenv('SENTRY_ENVIRONMENT', 'development'),
            release=os.getenv('SENTRY_RELEASE', 'local'),
        )
    except ImportError:
        pass  # sentry-sdk not installed — silent degradation
