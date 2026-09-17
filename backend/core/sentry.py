"""Sentry and central log-redaction initialization for the 4VELO backend.

Loaded via settings.py. T71/DS-017 installs process-wide Python log redaction
even when Sentry is disabled, and applies the same policy to Sentry events.
``send_default_pii=False`` remains defence in depth rather than the sole privacy
control.
"""

import os

from core.log_redaction import install_log_redaction, redact_sentry_event

# settings.py imports this module before the rest of Django configuration. Install
# the factory at import time so later application/library LogRecords are scrubbed.
install_log_redaction()


def init_sentry() -> None:
    """Initialise Sentry when ``SENTRY_DSN`` is configured."""

    dsn = os.getenv("SENTRY_DSN", "")
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
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            profiles_sample_rate=0.05,
            send_default_pii=False,
            before_send=redact_sentry_event,
            environment=os.getenv("SENTRY_ENVIRONMENT", "development"),
            release=os.getenv("SENTRY_RELEASE", "local"),
        )
    except ImportError:
        pass  # sentry-sdk not installed — silent degradation
