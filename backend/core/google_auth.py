"""
Custom Google OAuth2 login — bypasses allauth for simplicity.

T08: OAuth state is mandatory and consumed atomically with provider binding.
Any state failure (missing, malformed, replayed, provider-mismatched,
client-invalid, or Redis down) returns HTTP 400 BEFORE any external request,
user creation or token issuance.
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

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_SECRET = os.getenv("GOOGLE_SECRET", "")
REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "https://backend-production-55c7.up.railway.app/api/auth/google/callback/",
)


def _oauth_state_error_response(exc: OAuthStateError) -> JsonResponse:
    """Build a generic, non-leaking 400 for OAuth state failures.

    The raw nonce, access tokens, and stored payload must never reach the
    response body or logs.
    """
    return JsonResponse({"error": f"OAuth state rejected: {exc.code}"}, status=400)


@api_view(["GET"])
@permission_classes([AllowAny])
def google_login(request):
    """Redirect to Google OAuth consent screen."""
    if not GOOGLE_CLIENT_ID:
        return JsonResponse({"error": "Google OAuth not configured"}, status=501)

    client = normalize_client(request.GET.get("client"))
    state = store_oauth_state(client, "google")

    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        "&response_type=code"
        f"&redirect_uri={REDIRECT_URI}"
        "&scope=openid%20email%20profile"
        "&access_type=online"
        "&prompt=select_account"
    )
    return redirect(append_state_to_auth_url(auth_url, state))


@api_view(["GET"])
@permission_classes([AllowAny])
def google_callback(request):
    """Handle Google OAuth callback, create/get user, return JWT via redirect."""
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
        state_data = consume_oauth_state(request.GET.get("state"), expected_provider="google")
    except OAuthStateError as exc:
        return _oauth_state_error_response(exc)
    client = state_data["client"]

    token_resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": REDIRECT_URI,
        },
        timeout=10,
    )

    if token_resp.status_code != 200:
        return JsonResponse(
            {"error": "Token exchange failed"}, status=400
        )

    access_token = token_resp.json().get("access_token")
    user_info = requests.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    ).json()

    email = (user_info.get("email") or "").strip()
    name = user_info.get("name", "")
    google_id = user_info.get("id", "")

    if not email:
        return JsonResponse({"error": "Could not get email from Google"}, status=400)

    first_name = user_info.get("given_name") or (name.split()[0] if " " in name else name)
    last_name = user_info.get("family_name") or (name.split()[-1] if " " in name else "")

    try:
        user, _ = find_or_create_oauth_user(
            email=email,
            first_name=first_name,
            last_name=last_name,
            provider="google",
            provider_id=str(google_id),
            client=client,
        )
    except ValueError:
        return JsonResponse({"error": "OAuth account could not be linked."}, status=400)

    return oauth_callback_redirect(user, client=client)
