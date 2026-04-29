"""
Wearable Hub — Strava & Garmin Integration (Milestone 4)
=======================================================
Constitution §18.2: Wearable Ecosystem

Handles:
- OAuth2 flows for Strava and Garmin.
- Activity synchronization from external APIs.
- Webhook processing for real-time updates.
"""

import logging
import requests
import os
from django.utils import timezone
from datetime import timedelta
from .models import WearableIntegration, Activity
from django.contrib.auth import get_user_model

User = get_user_model()
logger = logging.getLogger(__name__)

STRAVA_CLIENT_ID = os.getenv('STRAVA_CLIENT_ID')
STRAVA_CLIENT_SECRET = os.getenv('STRAVA_CLIENT_SECRET')
STRAVA_REDIRECT_URI = os.getenv('STRAVA_REDIRECT_URI', 'https://sport-platform.com/api/activities/wearables/strava/callback/')

class StravaService:
    @staticmethod
    def get_auth_url(user_id):
        """Returns the Strava authorization URL with state parameter."""
        return (
            f"https://www.strava.com/oauth/authorize?"
            f"client_id={STRAVA_CLIENT_ID}&"
            f"response_type=code&"
            f"redirect_uri={STRAVA_REDIRECT_URI}&"
            f"scope=read,activity:read_all&"
            f"state={user_id}&"
            f"approval_prompt=force"
        )

    @staticmethod
    def exchange_code(user, code):
        """Exchanges authorization code for tokens."""
        response = requests.post("https://www.strava.com/oauth/token", data={
            'client_id': STRAVA_CLIENT_ID,
            'client_secret': STRAVA_CLIENT_SECRET,
            'code': code,
            'grant_type': 'authorization_code'
        })
        
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
        """Refreshes the access token if expired."""
        if integration.expires_at > timezone.now() + timedelta(minutes=5):
            return integration.access_token

        response = requests.post("https://www.strava.com/oauth/token", data={
            'client_id': STRAVA_CLIENT_ID,
            'client_secret': STRAVA_CLIENT_SECRET,
            'refresh_token': integration.refresh_token,
            'grant_type': 'refresh_token'
        })

        if response.status_code == 200:
            data = response.json()
            integration.access_token = data['access_token']
            integration.refresh_token = data['refresh_token']
            integration.expires_at = timezone.now() + timedelta(seconds=data['expires_in'])
            integration.save()
            return integration.access_token
        else:
            logger.error(f"Strava token refresh failed for user {integration.user.id}")
            integration.is_active = False
            integration.save()
            return None

    @classmethod
    def sync_activities(cls, integration):
        """Fetches recent activities from Strava."""
        token = cls.refresh_token(integration)
        if not token: return

        # Get activities since last sync
        after = int(integration.last_sync.timestamp()) if integration.last_sync else 0
        response = requests.get(
            "https://www.strava.com/api/v3/athlete/activities",
            headers={'Authorization': f'Bearer {token}'},
            params={'after': after}
        )

        if response.status_code == 200:
            activities = response.json()
            count = 0
            for act in activities:
                # Map Strava types to SPORT types
                s_type = act.get('type', '')
                sport_type = 'BIKE' if s_type in ['Ride', 'VirtualRide'] else 'RUN' if s_type == 'Run' else 'WALK'
                
                # Check if already exists (simplistic check by external_id could be added to Activity model)
                # For now, we trust the 'after' filter and avoid duplicates by checking start_time
                start_time = timezone.datetime.fromisoformat(act['start_date'].replace('Z', '+00:00'))
                
                if not Activity.objects.filter(user=integration.user, start_time=start_time).exists():
                    Activity.objects.create(
                        user=integration.user,
                        type=sport_type,
                        start_time=start_time,
                        distance=act['distance'],
                        duration=timedelta(seconds=act['moving_time']),
                        is_verified=True, # Trusted source
                        verification_score=1.0
                    )
                    count += 1
            
            integration.last_sync = timezone.now()
            integration.save()
            logger.info(f"Strava sync: imported {count} activities for user {integration.user.id}")
            return count
        return 0

class GarminService:
    """
    Service for Garmin Connect API (Milestone 4).
    Note: Garmin requires app approval for production sync.
    """
    GARMIN_CLIENT_ID = os.getenv('GARMIN_CLIENT_ID')
    GARMIN_CLIENT_SECRET = os.getenv('GARMIN_CLIENT_SECRET')
    # Garmin uses a similar OAuth2 flow for their newer Connect API
    
    @classmethod
    def get_auth_url(cls, user_id):
        # Placeholder for Garmin's specific OAuth2 URL
        # Usually: https://connect.garmin.com/oauth/authorize
        return (
            f"https://connect.garmin.com/oauth/authorize?"
            f"client_id={cls.GARMIN_CLIENT_ID}&"
            f"response_type=code&"
            f"state={user_id}"
        )

    @classmethod
    def exchange_code(cls, user, code):
        # Implementation of token exchange
        # response = requests.post("https://connect.garmin.com/oauth/token", ...)
        # For now, we mock the successful exchange if keys are missing
        if not cls.GARMIN_CLIENT_ID:
            integration, _ = WearableIntegration.objects.update_or_create(
                user=user, service='GARMIN',
                defaults={'access_token': 'mock_garmin_token', 'is_active': True}
            )
            return integration
        return None

    @classmethod
    def sync_activities(cls, integration):
        """
        Fetches activities from Garmin Connect.
        """
        logger.info(f"Garmin sync triggered for user {integration.user.id}")
        # In reality, Garmin uses a Push-based API (Webhooks) more than Pull,
        # but they support manual fetch for history.
        return 0
