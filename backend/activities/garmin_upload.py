"""
Garmin Connect upload service.
Uses the unofficial garminconnect library (login+password, not OAuth).

Fallback to mock mode when GARMIN_SIM_MOCK=1 or library unavailable.
"""

from __future__ import annotations

import logging
import os

from django.core.cache import cache

logger = logging.getLogger(__name__)

MOCK_MODE = os.getenv("GARMIN_SIM_MOCK", "0").lower() in ("1", "true", "yes", "on")
GARMINCONNECT_AVAILABLE = False

try:
    if not MOCK_MODE:
        from garminconnect import Garmin, GarminConnectConnectionError, GarminConnectAuthenticationError  # noqa: F401
        GARMINCONNECT_AVAILABLE = True
except ImportError:
    logger.info("garminconnect library not installed — Garmin upload in mock mode")


def _garmin_client_cache_key(email: str) -> str:
    return f"garmin_session:{email}"


class GarminUploadService:

    @staticmethod
    def authenticate(email: str, password: str) -> object | None:
        if MOCK_MODE or not GARMINCONNECT_AVAILABLE:
            logger.info("Garmin auth mock for %s", email)
            return None

        cached = cache.get(_garmin_client_cache_key(email))
        if cached:
            return cached

        try:
            from garminconnect import Garmin  # noqa: F811
            client = Garmin(email, password)
            client.login()
            cache.set(_garmin_client_cache_key(email), client, 1800)
            logger.info("Garmin auth success for %s", email)
            return client
        except Exception as exc:
            logger.warning("Garmin auth failed for %s: %s", email, exc)
            return None

    @staticmethod
    def upload_activity(client: object, gpx_content: str, activity_name: str) -> str | None:
        if MOCK_MODE or not GARMINCONNECT_AVAILABLE or client is None:
            logger.info("Garmin upload mock: %s", activity_name)
            return _mock_activity_id(activity_name)

        try:
            result = client.upload_activity(gpx_content, "gpx", activity_name)  # type: ignore[union-attr]
            if isinstance(result, dict):
                activity_id = result.get("detailedImportResult", {}).get("uploadId") or str(result)
            else:
                activity_id = str(result)
            logger.info("Garmin upload success: %s (id=%s)", activity_name, activity_id)
            return activity_id
        except Exception as exc:
            logger.warning("Garmin upload failed for %s: %s", activity_name, exc)
            return None

    @staticmethod
    def upload_for_user(user: object, gpx_content: str, activity_name: str) -> str | None:
        from activities.models import GarminSimulatorCredential

        cred = GarminSimulatorCredential.objects.filter(user=user, is_active=True).first()
        if not cred:
            logger.warning("No Garmin credentials for user %s", getattr(user, "username", user))
            return None

        email = cred.decrypted_email
        password = cred.decrypted_password
        if not email or not password:
            logger.warning("Empty Garmin credentials for user %s", getattr(user, "username", user))
            return None

        client = GarminUploadService.authenticate(email, password)
        return GarminUploadService.upload_activity(client, gpx_content, activity_name)

    @staticmethod
    def is_available() -> bool:
        return GARMINCONNECT_AVAILABLE and not MOCK_MODE


def _mock_activity_id(activity_name: str) -> str:
    import hashlib
    import time
    raw = f"{activity_name}-{time.time()}"
    return f"mock-garmin-{hashlib.sha256(raw.encode()).hexdigest()[:12]}"
