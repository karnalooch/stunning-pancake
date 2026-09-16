"""Optional JWT gate for telemetry ingest (ADR 011 / Q-P2-1).

When ``TELEMETRY_INGEST_JWT_REQUIRED=1`` ingest POSTs must carry a Bearer JWT
signed with ``TELEMETRY_INGEST_JWT_SECRET`` (or shared ``SECRET_KEY``).  When
``TELEMETRY_INGEST_AUDIENCE_REQUIRED=1`` (default OFF — opt-in) the token
must also carry ``aud == "telemetry"`` so a Django access token cannot be
replayed against the telemetry service.  ``TELEMETRY_INGEST_AUDIENCE``
overrides the expected audience for tests; production keeps the default.

Rollout: deploy mobile with the per-activity token endpoint FIRST, then
flip ``TELEMETRY_INGEST_AUDIENCE_REQUIRED=1`` in the deploy env. See
PR #89 description for the full sequence.
"""

from __future__ import annotations

import os
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

INGEST_PREFIXES = ("/api/telemetry/ingest",)
DEFAULT_AUDIENCE = "telemetry"


def _truthy(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes")


def jwt_enforced() -> bool:
    return _truthy("TELEMETRY_INGEST_JWT_REQUIRED")


def audience_required() -> bool:
    # Default False so existing deployments do not silently reject telemetry
    # batches the day the backend ships — mobile must opt in by sending a
    # JWT with aud='telemetry' (see /api/activities/sessions/<id>/telemetry-token/).
    # Operators flip this on once they confirm the mobile rollout is complete.
    if os.getenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        return True
    return False


def expected_audience() -> str:
    return os.getenv("TELEMETRY_INGEST_AUDIENCE", DEFAULT_AUDIENCE).strip() or DEFAULT_AUDIENCE


def jwt_secret() -> str | None:
    secret = os.getenv("TELEMETRY_INGEST_JWT_SECRET") or os.getenv("SECRET_KEY")
    return secret.strip() if secret else None


def _is_ingest_path(path: str) -> bool:
    return any(path == prefix or path.startswith(f"{prefix}/") for prefix in INGEST_PREFIXES)


def _decode_bearer(token: str, secret: str) -> dict | None:
    """Decode and verify signature + exp without validating the ``aud`` claim.
    Audience is enforced by ``_validate_bearer_with_audience``; this helper
    exists for the middleware + test paths that need the raw claims.
    """
    try:
        import jwt
    except ImportError:
        return None

    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=None,
            options={"require": ["exp"], "verify_aud": False},
        )
    except Exception:
        return None


def _validate_bearer_with_audience(
    token: str, secret: str, audience: str
) -> tuple[bool, str | None]:
    """Returns (is_valid, error_reason). When ``audience_required()`` is true,
    the JWT ``aud`` claim must match ``audience`` (string or single-element
    list — both are accepted)."""
    claims = _decode_bearer(token, secret)
    if claims is None:
        return False, "invalid"
    if not audience_required():
        return True, None
    aud = claims.get("aud")
    if isinstance(aud, list):
        ok = audience in aud
    elif isinstance(aud, str):
        ok = aud == audience
    else:
        ok = False
    return ok, None if ok else "aud"


class IngestJwtMiddleware(BaseHTTPMiddleware):
    """When TELEMETRY_INGEST_JWT_REQUIRED=1, ingest POSTs need Bearer JWT
    with the expected audience (default ``telemetry``)."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method != "POST" or not _is_ingest_path(request.url.path):
            return await call_next(request)

        if not jwt_enforced():
            return await call_next(request)

        secret = jwt_secret()
        if not secret:
            return JSONResponse(
                status_code=503,
                content={"detail": "Ingest authentication unavailable"},
            )

        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Authorization required"})

        token = auth[7:].strip()
        if not token:
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})

        ok, reason = _validate_bearer_with_audience(token, secret, expected_audience())
        if not ok:
            detail = "Invalid or expired token" if reason == "invalid" else "Audience mismatch"
            return JSONResponse(status_code=401, content={"detail": detail})

        return await call_next(request)
