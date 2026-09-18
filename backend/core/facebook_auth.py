"""
Custom Facebook OAuth2 login — matches Google OAuth style.

T08: OAuth state is mandatory and consumed atomically with provider binding.
Any state failure (missing, malformed, replayed, provider-mismatched,
client-invalid, or Redis down) returns HTTP 400 BEFORE any external request,
user creation or token issuance. Mirrors ``core/google_auth.py``.
"""

import os

import requests
from django.http import JsonResponse
from django.shortcuts import redirect
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from core.social_auth import (
    OAuthStateError,
    append_state_to_auth_url,
    consume_oauth_state,
    find_or_create_oauth_user,
    normalize_client,
    oauth_callback_redirect,
    store_oauth_state,
)

FACEBOOK_APP_ID = os.getenv("FACEBOOK_APP_ID", "")
FACEBOOK_SECRET = os.getenv("FACEBOOK_SECRET", "")
REDIRECT_URI = os.getenv(
    "FACEBOOK_REDIRECT_URI",
    "https://backend-production-55c7.up.railway.app/api/auth/facebook/callback/",
)


def _oauth_state_error_response(exc: OAuthStateError) -> JsonResponse:
    """Build a generic, non-leaking 400 for OAuth state failures.

    The raw nonce, access tokens, and stored payload must never reach the
    response body or logs.
    """
    return JsonResponse({"error": f"OAuth state rejected: {exc.code}"}, status=400)


@api_view(["GET"])
@permission_classes([AllowAny])
def facebook_login(request):
    """Redirect to Facebook OAuth login dialog."""
    if not FACEBOOK_APP_ID:
        return JsonResponse({"error": "Facebook OAuth not configured"}, status=501)

    client = normalize_client(request.GET.get("client"))
    state = store_oauth_state(client, "facebook")

    auth_url = (
        "https://www.facebook.com/v18.0/dialog/oauth"
        f"?client_id={FACEBOOK_APP_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        "&scope=email,public_profile"
        "&response_type=code"
    )
    return redirect(append_state_to_auth_url(auth_url, state))


@api_view(["GET"])
@permission_classes([AllowAny])
def facebook_callback(request):
    """Handle Facebook OAuth callback, create/get user, return JWT via redirect."""
    code = request.GET.get("code")
    if not code:
        error = (
            request.GET.get("error_description")
            or request.GET.get("error")
            or "No authorization code"
        )
        return JsonResponse({"error": error}, status=400)

    # T08: state is mandatory and consumed atomically with provider binding.
    # Any failure here short-circuits BEFORE token exchange, profile fetch,
    # user creation, JWT issuance and redirect.
    try:
        state_data = consume_oauth_state(request.GET.get("state"), expected_provider="facebook")
    except OAuthStateError as exc:
        return _oauth_state_error_response(exc)
    client = state_data["client"]

    token_resp = requests.get(
        "https://graph.facebook.com/v18.0/oauth/access_token",
        params={
            "client_id": FACEBOOK_APP_ID,
            "client_secret": FACEBOOK_SECRET,
            "redirect_uri": REDIRECT_URI,
            "code": code,
        },
        timeout=10,
    )

    if token_resp.status_code != 200:
        return JsonResponse({"error": "Token exchange failed"}, status=400)

    access_token = token_resp.json().get("access_token")
    profile_resp = requests.get(
        "https://graph.facebook.com/me",
        params={
            "fields": "id,name,email,first_name,last_name",
            "access_token": access_token,
        },
        timeout=10,
    )

    if profile_resp.status_code != 200:
        return JsonResponse(
            {"error": "Failed to retrieve Facebook profile"},
            status=400,
        )

    user_info = profile_resp.json()
    email = (user_info.get("email") or "").strip()
    first_name = user_info.get("first_name", "")
    last_name = user_info.get("last_name", "")
    name = user_info.get("name", "")
    fb_id = user_info.get("id", "")

    if not email:
        email = f"{fb_id}@facebook.local"

    try:
        user, _ = find_or_create_oauth_user(
            email=email,
            first_name=first_name or (name.split()[0] if " " in name else name),
            last_name=last_name or (name.split()[-1] if " " in name else ""),
            provider="facebook",
            provider_id=str(fb_id),
            client=client,
        )
    except ValueError:
        return JsonResponse({"error": "OAuth account could not be linked."}, status=400)

    return oauth_callback_redirect(user, client=client)
