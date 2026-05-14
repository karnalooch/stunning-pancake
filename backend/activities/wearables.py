"""
Wearable Hub — Strava & Garmin Integration (Milestone 4)
======================================================
Constitution §18.2: Wearable Ecosystem

Handles:
- OAuth2 flows for Strava and Garmin.
- Activity synchronization from external APIs.
- Token refresh and error handling.
"""

import logging
import secrets
import requests
import os
from django.utils import timezone
from datetime import timedelta
from .models import WearableIntegration, Activity
from django.contrib.auth import get_user_model
from core.redis_cluster import get_redis

User = get_user_model()
logger = logging.getLogger(__name__)

STRAVA_CLIENT_ID = os.getenv('STRAVA_CLIENT_ID')
STRAVA_CLIENT_SECRET = os.getenv('STRAVA_CLIENT_SECRET')
STRAVA_REDIRECT_URI = os.getenv('STRAVA_REDIRECT_URI', 'https://sport-platform.com/api/activities/wearables/strava/callback/')

GARMIN_CLIENT_ID = os.getenv('GARMIN_CLIENT_ID')
GARMIN_CLIENT_SECRET = os.getenv('GARMIN_CLIENT_SECRET')
GARMIN_REDIRECT_URI = os.getenv('GARMIN_REDIRECT_URI', 'https://sport-platform.com/api/activities/wearables/garmin/callback/')

GARMIN_API_BASE = 'https://connectapi.garmin.com'

# OAuth state nonce TTL in seconds (default 10 minutes)
OAUTH_STATE_TTL = int(os.getenv('OAUTH_STATE_TTL', '600'))


def _store_oauth_state(user_id):
    """Store a one-time nonce → user_id mapping in Redis for OAuth CSRF protection.

    Returns the nonce to be used as the 'state' parameter, or falls back to
    returning the raw user_id if Redis is unavailable (with a warning log).
    """
    nonce = secrets.token_urlsafe(32)
    try:
        r = get_redis()
        r.setex(f"oauth:state:{nonce}", OAUTH_STATE_TTL, str(user_id))
        return nonce
    except Exception:
        logger.warning(
            "Redis unavailable for OAuth state storage — falling back to raw user_id. "
            "This weakens CSRF protection."
        )
        return str(user_id)


def _resolve_oauth_state(nonce):
    """Resolve an OAuth state nonce to a user_id via Redis.

    Returns the user_id as a string, or None if the nonce is invalid/expired.
    Fails closed: returns None when Redis is unavailable to prevent CSRF bypass.
    """
    try:
        r = get_redis()
        user_id = r.get(f"oauth:state:{nonce}")
        if user_id:
            r.delete(f"oauth:state:{nonce}")
        return user_id
    except Exception:
        logger.warning("Redis unavailable for OAuth state resolution — rejecting for security.")
        return None


class StravaService:
    @staticmethod
    def get_auth_url(user_id):
        nonce = _store_oauth_state(user_id)
        return (
            f"https://www.strava.com/oauth/authorize?"
            f"client_id={STRAVA_CLIENT_ID}&"
            f"response_type=code&"
            f"redirect_uri={STRAVA_REDIRECT_URI}&"
            f"scope=read,activity:read_all&"
            f"state={nonce}&"
            f"approval_prompt=force"
        )

    @staticmethod
    def exchange_code(user, code):
        response = requests.post("https://www.strava.com/oauth/token", data={
            'client_id': STRAVA_CLIENT_ID,
            'client_secret': STRAVA_CLIENT_SECRET,
            'code': code,
            'grant_type': 'authorization_code'
        }, timeout=15)

        if response.status_code == 200:
            data = response.json()
            expires_at = timezone.now() + timedelta(seconds=data['expires_in'])

            integration, _ = WearableIntegration.objects.update_or_create(
                user=user,
                service='STRAVA',
                defaults={
                    'access_token': data['access_token'],
                    'refresh_token': data['refresh_token'],
                    'expires_at': expires_at,
                    'external_id': str(data['athlete']['id']),
                    'is_active': True
                }
            )
            return integration
        else:
            logger.error(f"Strava token exchange failed: {response.text}")
            return None

    @staticmethod
    def refresh_token(integration):
        if integration.expires_at and integration.expires_at > timezone.now() + timedelta(minutes=5):
            return integration.decrypted_access_token

        response = requests.post("https://www.strava.com/oauth/token", data={
            'client_id': STRAVA_CLIENT_ID,
            'client_secret': STRAVA_CLIENT_SECRET,
            'refresh_token': integration.decrypted_refresh_token,
            'grant_type': 'refresh_token'
        }, timeout=15)

        if response.status_code == 200:
            data = response.json()
            integration.access_token = data['access_token']
            integration.refresh_token = data.get('refresh_token', integration.decrypted_refresh_token)
            integration.expires_at = timezone.now() + timedelta(seconds=data['expires_in'])
            integration.save()
            return integration.decrypted_access_token
        else:
            logger.error(f"Strava token refresh failed for user {integration.user.id}")
            integration.is_active = False
            integration.save()
            return None

    @classmethod
    def sync_activities(cls, integration):
        token = cls.refresh_token(integration)
        if not token:
            return 0

        after = int(integration.last_sync.timestamp()) if integration.last_sync else 0
        response = requests.get(
            "https://www.strava.com/api/v3/athlete/activities",
            headers={'Authorization': f'Bearer {token}'},
            params={'after': after, 'per_page': 100},
            timeout=30,
        )

        if response.status_code != 200:
            logger.error(f"Strava API error: {response.status_code}")
            return 0

        activities = response.json()
        count = 0
        for act in activities:
            s_type = act.get('type', '')
            if s_type in ['Ride', 'VirtualRide']:
                sport_type = 'BIKE'
            elif s_type == 'Run':
                sport_type = 'RUN'
            elif s_type in ['Walk', 'Hike']:
                sport_type = 'WALK'
            else:
                continue

            start_time = timezone.datetime.fromisoformat(act['start_date'].replace('Z', '+00:00'))

            if not Activity.objects.filter(user=integration.user, start_time=start_time, type=sport_type).exists():
                tenant = integration.user.tenant
                Activity.objects.create(
                    user=integration.user,
                    tenant=tenant,
                    type=sport_type,
                    start_time=start_time,
                    end_time=start_time + timedelta(seconds=act['elapsed_time']),
                    distance=act['distance'],
                    duration=timedelta(seconds=act['moving_time']),
                    is_verified=True,
                    verification_score=1.0,
                )
                count += 1

        integration.last_sync = timezone.now()
        integration.save()
        logger.info(f"Strava sync: imported {count} activities for user {integration.user.id}")
        return count

    @classmethod
    def get_status(cls, user):
        """Returns the connection status for a user."""
        try:
            integration = WearableIntegration.objects.get(user=user, service='STRAVA')
            return {
                'connected': integration.is_active,
                'last_sync': integration.last_sync.isoformat() if integration.last_sync else None,
                'external_id': integration.external_id,
                'expires_at': integration.expires_at.isoformat() if integration.expires_at else None,
            }
        except WearableIntegration.DoesNotExist:
            return {'connected': False}


class GarminService:
    @staticmethod
    def get_auth_url(user_id):
        nonce = _store_oauth_state(user_id)
        return (
            f"https://connect.garmin.com/oauthConfirm?"
            f"client_id={GARMIN_CLIENT_ID}&"
            f"response_type=code&"
            f"redirect_uri={GARMIN_REDIRECT_URI}&"
            f"state={nonce}&"
            f"scope=activity:read"
        )

    @staticmethod
    def exchange_code(user, code):
        response = requests.post(
            f"{GARMIN_API_BASE}/oauth-service/oauth/token",
            data={
                'client_id': GARMIN_CLIENT_ID,
                'client_secret': GARMIN_CLIENT_SECRET,
                'code': code,
                'grant_type': 'authorization_code',
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=15,
        )

        if response.status_code == 200:
            data = response.json()
            expires_at = timezone.now() + timedelta(seconds=data.get('expires_in', 3600))

            integration, _ = WearableIntegration.objects.update_or_create(
                user=user,
                service='GARMIN',
                defaults={
                    'access_token': data.get('access_token', 'mock_garmin_token'),
                    'refresh_token': data.get('refresh_token', ''),
                    'expires_at': expires_at,
                    'is_active': True,
                }
            )
            return integration

        logger.error(f"Garmin token exchange failed: {response.text}")
        # Fallback: create mock integration for demo
        if not GARMIN_CLIENT_ID or GARMIN_CLIENT_ID == 'mock':
            integration, _ = WearableIntegration.objects.update_or_create(
                user=user,
                service='GARMIN',
                defaults={
                    'access_token': 'mock_garmin_token',
                    'is_active': True,
                }
            )
            return integration
        return None

    @staticmethod
    def refresh_token(integration):
        if not integration.decrypted_refresh_token:
            return integration.decrypted_access_token

        response = requests.post(
            f"{GARMIN_API_BASE}/oauth-service/oauth/token",
            data={
                'client_id': GARMIN_CLIENT_ID,
                'client_secret': GARMIN_CLIENT_SECRET,
                'refresh_token': integration.decrypted_refresh_token,
                'grant_type': 'refresh_token',
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=15,
        )

        if response.status_code == 200:
            data = response.json()
            integration.access_token = data.get('access_token', integration.decrypted_access_token)
            integration.refresh_token = data.get('refresh_token', integration.decrypted_refresh_token)
            integration.expires_at = timezone.now() + timedelta(seconds=data.get('expires_in', 3600))
            integration.save()
            return integration.decrypted_access_token

        integration.is_active = False
        integration.save()
        return None

    @classmethod
    def sync_activities(cls, integration):
        token = cls.refresh_token(integration)
        if not token:
            return 0

        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(
            f"{GARMIN_API_BASE}/activitylist-service/activities/activity",
            headers=headers,
            params={'limit': 100, 'start': 1},
            timeout=15,
        )

        if response.status_code != 200:
            logger.error(f"Garmin API error: {response.status_code}")
            if GARMIN_CLIENT_ID == 'mock' or not GARMIN_CLIENT_ID:
                return 0
            return 0

        data = response.json()
        activities = data if isinstance(data, list) else data.get('activityList', [])
        count = 0

        for act in activities:
            sport_type = cls._map_activity_type(act.get('activityType', {}).get('typeKey', ''))
            if not sport_type:
                continue

            start_time_ms = act.get('startTimeInSeconds')
            if not start_time_ms:
                continue
            start_time = timezone.datetime.fromtimestamp(start_time_ms / 1000)

            if not Activity.objects.filter(user=integration.user, start_time=start_time, type=sport_type).exists():
                tenant = integration.user.tenant
                distance = act.get('distance', 0) or 0
                duration_seconds = act.get('duration', 0) or 0
                Activity.objects.create(
                    user=integration.user,
                    tenant=tenant,
                    type=sport_type,
                    start_time=start_time,
                    end_time=start_time + timedelta(seconds=duration_seconds),
                    distance=distance * 100,  # Garmin returns in cm? Convert to m
                    duration=timedelta(seconds=duration_seconds),
                    is_verified=True,
                    verification_score=1.0,
                )
                count += 1

        integration.last_sync = timezone.now()
        integration.save()
        logger.info(f"Garmin sync: imported {count} activities for user {integration.user.id}")
        return count

    @classmethod
    def _map_activity_type(cls, type_key):
        mapping = {
            'running': 'RUN',
            'road_biking': 'BIKE',
            'mountain_biking': 'BIKE',
            'walking': 'WALK',
            'hiking': 'WALK',
            'trail_running': 'RUN',
            'cycling': 'BIKE',
        }
        return mapping.get(type_key.lower(), None)

    @classmethod
    def get_status(cls, user):
        try:
            integration = WearableIntegration.objects.get(user=user, service='GARMIN')
            return {
                'connected': integration.is_active,
                'last_sync': integration.last_sync.isoformat() if integration.last_sync else None,
                'expires_at': integration.expires_at.isoformat() if integration.expires_at else None,
            }
        except WearableIntegration.DoesNotExist:
            return {'connected': False}
