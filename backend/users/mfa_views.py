"""MFA setup and verification API (P2 Auth)."""

from __future__ import annotations

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.mfa import generate_totp_secret, provisioning_uri, verify_totp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mfa_status_view(request):
    user = request.user
    return Response(
        {
            "mfa_enabled": bool(getattr(user, "mfa_enabled", False)),
            "required_for_role": user.role == "GLOBAL_OWNER",
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mfa_setup_view(request):
    """Generate a new TOTP secret (not enabled until verified)."""
    secret = generate_totp_secret()
    user = request.user
    user.mfa_secret_pending = secret
    user.save(update_fields=["mfa_secret_pending"])
    return Response(
        {
            "secret": secret,
            "provisioning_uri": provisioning_uri(secret, user.username),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mfa_enable_view(request):
    code = str(request.data.get("code", "")).strip()
    user = request.user
    secret = getattr(user, "mfa_secret_pending", None) or getattr(user, "mfa_secret", None)
    if not secret or not verify_totp(secret, code):
        return Response({"error": "Invalid verification code."}, status=status.HTTP_400_BAD_REQUEST)
    user.mfa_secret = secret
    user.mfa_enabled = True
    user.mfa_secret_pending = ""
    user.save(update_fields=["mfa_secret", "mfa_enabled", "mfa_secret_pending"])
    return Response({"mfa_enabled": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mfa_disable_view(request):
    user = request.user
    code = str(request.data.get("code", "")).strip()
    secret = getattr(user, "mfa_secret", None)
    if user.mfa_enabled and secret and not verify_totp(secret, code):
        return Response({"error": "Invalid verification code."}, status=status.HTTP_400_BAD_REQUEST)
    user.mfa_enabled = False
    user.mfa_secret = ""
    user.mfa_secret_pending = ""
    user.save(update_fields=["mfa_enabled", "mfa_secret", "mfa_secret_pending"])
    return Response({"mfa_enabled": False})
