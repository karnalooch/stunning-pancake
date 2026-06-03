"""
Shared Google / Facebook OAuth helpers — login + auto-register in one flow.
"""

from __future__ import annotations

import json
import logging
import os
import secrets
from urllib.parse import quote, urlencode

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from core.redis_cluster import get_redis

logger = logging.getLogger(__name__)

OAUTH_STATE_TTL = int(os.getenv("OAUTH_STATE_TTL", "600"))
DEFAULT_OAUTH_TENANT_ID = os.getenv("DEFAULT_OAUTH_TENANT_ID", "siedlce-city")
MOBILE_DEEP_LINK_SCHEME = os.getenv("MOBILE_DEEP_LINK_SCHEME", "fourvelo")


def _state_key(nonce: str) -> str:
    return f"oauth:social:{nonce}"


def store_oauth_state(client: str, provider: str) -> str:
    """Persist OAuth CSRF state; returns nonce for provider redirect."""
    nonce = secrets.token_urlsafe(32)
    payload = json.dumps({"client": client, "provider": provider})
    r = get_redis()
    r.setex(_state_key(nonce), OAUTH_STATE_TTL, payload)
    return nonce


def resolve_oauth_state(nonce: str | None) -> dict | None:
    if not nonce:
        return None
    try:
        r = get_redis()
        raw = r.get(_state_key(nonce))
        if not raw:
            return None
        r.delete(_state_key(nonce))
        if isinstance(raw, bytes):
            raw = raw.decode()
        return json.loads(raw)
    except Exception:
        logger.warning("OAuth state resolution failed")
        return None


def normalize_client(raw: str | None) -> str:
    return "mobile" if raw == "mobile" else "admin"


def _unique_username(base: str) -> str:
    User = get_user_model()
    base = (base or "user").strip()[:140] or "user"
    if not User.objects.filter(username=base).exists():
        return base
    for i in range(1, 1000):
        candidate = f"{base}{i}"[:150]
        if not User.objects.filter(username=candidate).exists():
            return candidate
    return f"{base}_{secrets.token_hex(4)}"[:150]


def find_or_create_oauth_user(
    *,
    email: str,
    first_name: str = "",
    last_name: str = "",
    provider: str,
    provider_id: str = "",
    client: str = "admin",
) -> tuple[object, bool]:
    """Find user by email or create ATHLETE account (register + login unified)."""
    User = get_user_model()
    email = (email or "").strip().lower()
    if not email:
        raise ValueError("Email is required for OAuth sign-in")

    created = False
    username_base = email.split("@")[0]

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        try:
            user = User.objects.get(username=username_base)
        except User.DoesNotExist:
            user = User.objects.create_user(
                username=_unique_username(username_base),
                email=email,
                first_name=first_name or "",
                last_name=last_name or "",
                role="ATHLETE",
            )
            created = True

    if created and client == "mobile":
        tenant_id = DEFAULT_OAUTH_TENANT_ID
        if tenant_id:
            from users.models import Tenant

            if Tenant.objects.filter(id=tenant_id).exists():
                user.tenant_id = tenant_id

    admin_emails = [
        e.strip().lower() for e in os.getenv("GLOBAL_OWNER_EMAILS", "").split(",") if e.strip()
    ]
    if email in admin_emails or getattr(user, "role", "") == "GLOBAL_OWNER":
        user.role = "GLOBAL_OWNER"
        user.is_staff = True
        user.is_superuser = True

    if first_name and not user.first_name:
        user.first_name = first_name
    if last_name and not user.last_name:
        user.last_name = last_name

    user.save()
    logger.info(
        "oauth.%s user_id=%s created=%s provider_id=%s", provider, user.id, created, provider_id
    )
    return user, created


def build_auth_redirect(user, client: str = "admin") -> str:
    refresh = RefreshToken.for_user(user)
    access = str(refresh.access_token)
    refresh_str = str(refresh)
    params = urlencode({"access": access, "refresh": refresh_str})

    if client == "mobile":
        return f"{MOBILE_DEEP_LINK_SCHEME}://auth/callback?{params}"

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return f"{frontend_url}/#/auth/callback?{params}"


def append_state_to_auth_url(auth_url: str, state: str) -> str:
    sep = "&" if "?" in auth_url else "?"
    return f"{auth_url}{sep}state={quote(state)}"
