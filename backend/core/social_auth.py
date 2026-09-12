"""
Shared Google / Facebook OAuth helpers — login + auto-register in one flow.

T08 hardening: OAuth state is now consumed atomically (GETDEL), validated
against a strict allow-list (provider + client) and fail-closed on any
deviation. Provider binding is enforced by ``consume_oauth_state`` which
takes the expected provider for the current callback.
"""

from __future__ import annotations

import json
import logging
import os
import secrets
from urllib.parse import quote, urlencode

from django.contrib.auth import get_user_model
from django.http import HttpResponseRedirect

from core.redis_cluster import get_redis
from users.jwt_views import restricted_token_pair_for_user

logger = logging.getLogger(__name__)

OAUTH_STATE_TTL = int(os.getenv("OAUTH_STATE_TTL", "600"))
DEFAULT_OAUTH_TENANT_ID = os.getenv("DEFAULT_OAUTH_TENANT_ID", "siedlce-city")
MOBILE_DEEP_LINK_SCHEME = os.getenv("MOBILE_DEEP_LINK_SCHEME", "fourvelo")

ALLOWED_OAUTH_CLIENTS = ("admin", "mobile")
ALLOWED_OAUTH_PROVIDERS = ("google", "facebook")


class OAuthStateError(Exception):
    """Raised when an OAuth state nonce cannot be accepted.

    ``code`` is a short, non-sensitive identifier suitable for an HTTP 400
    response body. The full nonce and payload are NEVER exposed.
    """

    def __init__(self, code: str, message: str | None = None) -> None:
        super().__init__(message or code)
        self.code = code


def _state_key(nonce: str) -> str:
    return f"oauth:social:{nonce}"


def store_oauth_state(client: str, provider: str) -> str:
    """Persist OAuth CSRF state; returns nonce for provider redirect.

    The stored payload binds the nonce to ``(client, provider)`` so the
    callback can verify both atomically. ``normalize_client`` is applied so the
    persisted client is always one of :data:`ALLOWED_OAUTH_CLIENTS`.
    """
    client = normalize_client(client)
    if provider not in ALLOWED_OAUTH_PROVIDERS:
        raise ValueError(f"Unsupported OAuth provider: {provider!r}")
    nonce = secrets.token_urlsafe(32)
    payload = json.dumps({"client": client, "provider": provider})
    r = get_redis()
    r.setex(_state_key(nonce), OAUTH_STATE_TTL, payload)
    return nonce


def consume_oauth_state(nonce: str | None, *, expected_provider: str) -> dict:
    """Atomically consume a one-time OAuth state and return the validated payload.

    Contract (T08):

    * ``nonce`` empty / ``None`` → :class:`OAuthStateError` with code ``missing``.
    * Redis unavailability → ``redis_failure`` (fail-closed).
    * Unknown / expired / replayed nonce → ``unknown`` (state already consumed).
    * Stored value is not a JSON object → ``malformed``.
    * Missing ``provider`` or ``client`` keys → ``invalid_payload``.
    * ``provider`` not in allow-list → ``invalid_payload``.
    * ``client`` not in ``admin`` / ``mobile`` → ``invalid_client``.
    * ``provider`` mismatch with ``expected_provider`` → ``provider_mismatch``.

    The state record is removed in a single Redis operation (``GETDEL``) so two
    concurrent callbacks can never observe the same nonce. Malformed and
    provider-mismatched payloads still consume the state — otherwise an
    attacker could probe arbitrary nonces with arbitrary bodies.

    Returns a dict ``{"provider": str, "client": str}`` on success.
    """
    if not nonce:
        raise OAuthStateError("missing", "OAuth state is required")

    if expected_provider not in ALLOWED_OAUTH_PROVIDERS:
        # Programmer error — surface it loudly.
        raise OAuthStateError("invalid_payload", "Unsupported provider")

    try:
        r = get_redis()
        raw = r.getdel(_state_key(nonce))
    except Exception:
        logger.warning("oauth.state_redis_failure")
        raise OAuthStateError("redis_failure", "OAuth state backend unavailable")

    if raw is None:
        raise OAuthStateError("unknown", "OAuth state is invalid or expired")

    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")

    try:
        payload = json.loads(raw)
    except (TypeError, ValueError):
        logger.warning("oauth.state_malformed")
        raise OAuthStateError("malformed", "OAuth state payload is invalid")

    if not isinstance(payload, dict):
        logger.warning("oauth.state_not_object")
        raise OAuthStateError("malformed", "OAuth state payload is invalid")

    provider = payload.get("provider")
    client = payload.get("client")

    if not isinstance(provider, str) or not isinstance(client, str):
        raise OAuthStateError("invalid_payload", "OAuth state payload is incomplete")

    if provider not in ALLOWED_OAUTH_PROVIDERS:
        raise OAuthStateError("invalid_payload", "OAuth state provider is invalid")

    if client not in ALLOWED_OAUTH_CLIENTS:
        raise OAuthStateError("invalid_client", "OAuth state client is invalid")

    if provider != expected_provider:
        logger.warning(
            "oauth.state_provider_mismatch expected=%s got=%s",
            expected_provider,
            provider,
        )
        raise OAuthStateError("provider_mismatch", "OAuth state provider mismatch")

    return {"provider": provider, "client": client}


def normalize_client(raw: str | None) -> str:
    """Map a query-param ``client`` value to the stored allow-list entry.

    Only ``"mobile"`` is preserved; anything else (including ``None``, empty
    string, ``admin``, or unknown values) collapses to ``"admin"``. The OAuth
    callback later re-validates this against the persisted state, so the
    login-time normalization is best-effort but never trusted in isolation.
    """
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
    params = urlencode(restricted_token_pair_for_user(user))

    if client == "mobile":
        return f"{MOBILE_DEEP_LINK_SCHEME}://auth/callback?{params}"

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return f"{frontend_url}/#/auth/callback?{params}"


class OAuthCallbackRedirect(HttpResponseRedirect):
    """Redirect response that accepts the configured mobile deep-link scheme.

    The default ``HttpResponseRedirect`` rejects every scheme outside
    ``http``, ``https``, ``ftp`` and ``ftps`` via ``DisallowedRedirect`` which
    is the right behavior for ordinary application redirects. OAuth callbacks
    legitimately target a custom mobile scheme (``fourvelo://``) when the
    state-bound client is ``"mobile"`` — this subclass extends the per-instance
    allow-list narrowly for that scheme only.

    Security notes (T08):

    * The subclass does NOT mutate ``HttpResponseRedirect.allowed_schemes``
      globally; it only widens the allow-list for the instance that constructs
      this response. Ordinary ``HttpResponseRedirect`` calls elsewhere in the
      codebase keep Django's defaults.
    * ``client`` MUST be the validated state value (``"admin"`` or ``"mobile"``).
      The scheme is added based on that value, never on URL inspection, so an
      attacker cannot smuggle an arbitrary scheme through callback query
      parameters.
    * The deep-link scheme is the configured ``MOBILE_DEEP_LINK_SCHEME`` only.
      No other custom scheme is ever added, regardless of URL contents.
    """

    # ``allowed_schemes`` is a class attribute merged into the per-instance
    # check by ``HttpResponseRedirect``. Extending it here widens the allow-list
    # only for instances of this subclass; the base class is untouched.
    allowed_schemes = set(HttpResponseRedirect.allowed_schemes) | {MOBILE_DEEP_LINK_SCHEME}


def oauth_callback_redirect(user, *, client: str) -> HttpResponseRedirect:
    """Build the final OAuth callback response for the validated state client.

    ``client`` MUST be the value returned from :func:`consume_oauth_state` —
    that is the only source trusted to choose the redirect target. Callers
    MUST NOT derive ``client`` from query parameters or any other untrusted
    input.

    Returns an :class:`HttpResponseRedirect` subclass that accepts the
    configured mobile deep-link scheme in addition to Django's defaults.
    """
    if client not in ALLOWED_OAUTH_CLIENTS:
        # Defensive guard — ``consume_oauth_state`` already validated this, but
        # any future caller that bypasses it MUST be rejected loudly.
        raise ValueError(f"Invalid OAuth client: {client!r}")
    return OAuthCallbackRedirect(build_auth_redirect(user, client=client))


def append_state_to_auth_url(auth_url: str, state: str) -> str:
    sep = "&" if "?" in auth_url else "?"
    return f"{auth_url}{sep}state={quote(state)}"
