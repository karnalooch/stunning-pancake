"""
Custom Google OAuth2 login — bypasses allauth for simplicity.
"""
import os
import requests
from django.contrib.auth import get_user_model
from django.shortcuts import redirect
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken

GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_SECRET = os.getenv('GOOGLE_SECRET', '')
REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'https://backend-production-55c7.up.railway.app/api/auth/google/callback/')


@api_view(['GET'])
@permission_classes([AllowAny])
def google_login(request):
    """Redirect to Google OAuth consent screen."""
    if not GOOGLE_CLIENT_ID:
        return JsonResponse({'error': 'Google OAuth not configured'}, status=501)

    auth_url = (
        'https://accounts.google.com/o/oauth2/v2/auth'
        f'?client_id={GOOGLE_CLIENT_ID}'
        '&response_type=code'
        f'&redirect_uri={REDIRECT_URI}'
        '&scope=openid%20email%20profile'
        '&access_type=online'
    )
    return redirect(auth_url)


@api_view(['GET'])
@permission_classes([AllowAny])
def google_callback(request):
    """Handle Google OAuth callback, create/get user, return JWT tokens."""
    code = request.GET.get('code')
    if not code:
        return JsonResponse({'error': 'No authorization code'}, status=400)

    # Exchange code for tokens
    token_resp = requests.post('https://oauth2.googleapis.com/token', data={
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_SECRET,
        'code': code,
        'grant_type': 'authorization_code',
        'redirect_uri': REDIRECT_URI,
    }, timeout=10)

    if token_resp.status_code != 200:
        return JsonResponse({'error': 'Token exchange failed', 'detail': token_resp.text}, status=400)

    tokens = token_resp.json()
    access_token = tokens.get('access_token')

    # Get user info
    user_info = requests.get('https://www.googleapis.com/oauth2/v2/userinfo', headers={
        'Authorization': f'Bearer {access_token}',
    }, timeout=10).json()

    email = user_info.get('email', '')
    name = user_info.get('name', '')
    google_id = user_info.get('id', '')

    if not email:
        return JsonResponse({'error': 'Could not get email from Google'}, status=400)

    # Find or create user
    User = get_user_model()
    username = email.split('@')[0]

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=name.split()[0] if ' ' in name else name,
                last_name=name.split()[-1] if ' ' in name else '',
            )

    # Ensure GLOBAL_OWNER role for admin emails
    admin_emails = os.getenv('GLOBAL_OWNER_EMAILS', email).split(',')
    if email in admin_emails or user.role == 'GLOBAL_OWNER':
        user.role = 'GLOBAL_OWNER'
        user.is_staff = True
        user.is_superuser = True

    user.save()

    # Generate JWT
    refresh = RefreshToken.for_user(user)
    access = str(refresh.access_token)

    # Redirect to frontend with tokens
    frontend_url = os.getenv('FRONTEND_URL', 'https://admin-production-083b.up.railway.app')
    return redirect(
        f'{frontend_url}/#/auth/callback?access={access}&refresh={refresh}'
    )
