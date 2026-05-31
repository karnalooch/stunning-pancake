"""
Custom Google OAuth2 login — bypasses allauth for simplicity.
"""
import os

import requests
from django.http import JsonResponse
from django.shortcuts import redirect
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from core.social_auth import (
    append_state_to_auth_url,
    build_auth_redirect,
    find_or_create_oauth_user,
    normalize_client,
    resolve_oauth_state,
    store_oauth_state,
)

GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_SECRET = os.getenv('GOOGLE_SECRET', '')
REDIRECT_URI = os.getenv(
    'GOOGLE_REDIRECT_URI',
    'https://backend-production-55c7.up.railway.app/api/auth/google/callback/',
)


@api_view(['GET'])
@permission_classes([AllowAny])
def google_login(request):
    """Redirect to Google OAuth consent screen."""
    if not GOOGLE_CLIENT_ID:
        return JsonResponse({'error': 'Google OAuth not configured'}, status=501)

    client = normalize_client(request.GET.get('client'))
    state = store_oauth_state(client, 'google')

    auth_url = (
        'https://accounts.google.com/o/oauth2/v2/auth'
        f'?client_id={GOOGLE_CLIENT_ID}'
        '&response_type=code'
        f'&redirect_uri={REDIRECT_URI}'
        '&scope=openid%20email%20profile'
        '&access_type=online'
        '&prompt=select_account'
    )
    return redirect(append_state_to_auth_url(auth_url, state))


@api_view(['GET'])
@permission_classes([AllowAny])
def google_callback(request):
    """Handle Google OAuth callback, create/get user, return JWT via redirect."""
    code = request.GET.get('code')
    if not code:
        error = request.GET.get('error_description') or request.GET.get('error') or 'No authorization code'
        return JsonResponse({'error': error}, status=400)

    state_data = resolve_oauth_state(request.GET.get('state'))
    client = state_data.get('client', 'admin') if state_data else 'admin'

    token_resp = requests.post(
        'https://oauth2.googleapis.com/token',
        data={
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_SECRET,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': REDIRECT_URI,
        },
        timeout=10,
    )

    if token_resp.status_code != 200:
        return JsonResponse({'error': 'Token exchange failed', 'detail': token_resp.text}, status=400)

    access_token = token_resp.json().get('access_token')
    user_info = requests.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=10,
    ).json()

    email = (user_info.get('email') or '').strip()
    name = user_info.get('name', '')
    google_id = user_info.get('id', '')

    if not email:
        return JsonResponse({'error': 'Could not get email from Google'}, status=400)

    first_name = user_info.get('given_name') or (name.split()[0] if ' ' in name else name)
    last_name = user_info.get('family_name') or (name.split()[-1] if ' ' in name else '')

    try:
        user, _ = find_or_create_oauth_user(
            email=email,
            first_name=first_name,
            last_name=last_name,
            provider='google',
            provider_id=str(google_id),
            client=client,
        )
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)

    return redirect(build_auth_redirect(user, client=client))
