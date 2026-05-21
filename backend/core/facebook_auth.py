"""
Custom Facebook OAuth2 login — matches Google OAuth style.
"""
import os
import requests
from django.contrib.auth import get_user_model
from django.shortcuts import redirect
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken

FACEBOOK_APP_ID = os.getenv('FACEBOOK_APP_ID', '')
FACEBOOK_SECRET = os.getenv('FACEBOOK_SECRET', '')
REDIRECT_URI = os.getenv('FACEBOOK_REDIRECT_URI', 'https://backend-production-55c7.up.railway.app/api/auth/facebook/callback/')


@api_view(['GET'])
@permission_classes([AllowAny])
def facebook_login(request):
    """Redirect to Facebook OAuth login dialog."""
    if not FACEBOOK_APP_ID:
        return JsonResponse({'error': 'Facebook OAuth not configured'}, status=501)

    auth_url = (
        'https://www.facebook.com/v18.0/dialog/oauth'
        f'?client_id={FACEBOOK_APP_ID}'
        f'&redirect_uri={REDIRECT_URI}'
        '&scope=email,public_profile'
        '&response_type=code'
    )
    return redirect(auth_url)


@api_view(['GET'])
@permission_classes([AllowAny])
def facebook_callback(request):
    """Handle Facebook OAuth callback, create/get user, return JWT tokens."""
    code = request.GET.get('code')
    if not code:
        return JsonResponse({'error': 'No authorization code'}, status=400)

    # Exchange code for access token
    token_resp = requests.get('https://graph.facebook.com/v18.0/oauth/access_token', params={
        'client_id': FACEBOOK_APP_ID,
        'client_secret': FACEBOOK_SECRET,
        'redirect_uri': REDIRECT_URI,
        'code': code,
    }, timeout=10)

    if token_resp.status_code != 200:
        return JsonResponse({'error': 'Token exchange failed', 'detail': token_resp.text}, status=400)

    tokens = token_resp.json()
    access_token = tokens.get('access_token')

    # Get user profile information
    profile_resp = requests.get('https://graph.facebook.com/me', params={
        'fields': 'id,name,email,first_name,last_name',
        'access_token': access_token,
    }, timeout=10)

    if profile_resp.status_code != 200:
        return JsonResponse({'error': 'Failed to retrieve Facebook profile', 'detail': profile_resp.text}, status=400)

    user_info = profile_resp.json()
    email = user_info.get('email')
    first_name = user_info.get('first_name', '')
    last_name = user_info.get('last_name', '')
    name = user_info.get('name', '')

    # If Facebook account doesn't have an email verified/set, fallback to id-based email
    if not email:
        email = f"{user_info.get('id')}@facebook.com"

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
                first_name=first_name or (name.split()[0] if ' ' in name else name),
                last_name=last_name or (name.split()[-1] if ' ' in name else ''),
            )

    # Ensure GLOBAL_OWNER role for admin emails
    admin_emails = os.getenv('GLOBAL_OWNER_EMAILS', '').split(',')
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
