"""Optional JWT gate for telemetry ingest (ADR 011 / Q-P2-1).

When ``TELEMETRY_INGEST_JWT_REQUIRED=1`` ingest POSTs must carry a Bearer JWT
signed with ``TELEMETRY_INGEST_JWT_SECRET`` (or shared ``SECRET_KEY``). When
``TELEMETRY_INGEST_AUDIENCE_REQUIRED=1`` (default OFF — opt-in) the token
must also carry ``aud == "telemetry"`` so a Django access token cannot be
replayed against the telemetry service.

Per-activity tokens additionally carry ``activity_id`` and ``sub``. Whenever
those claims are present they are enforced against the ingest payload; when
audience enforcement is enabled they are required. This prevents a valid token
for one ride/user from writing GPS rows into another activity.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Iterable
from contextvars import ContextVar

from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

INGEST_PREFIXES = ("/api/telemetry/ingest",)
DEFAULT_AUDIENCE = "telemetry"

_request_ingest_claims: ContextVar[dict | None] = ContextVar(
    "telemetry_ingest_claims",
    default=None,
)


def _truthy(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes")


def jwt_enforced() -> bool:
    return _truthy("TELEMETRY_INGEST_JWT_REQUIRED")


def audience_required() -> bool:
    # Default False so existing deployments do not silently reject telemetry
    # batches the day the backend ships — mobile must opt in by sending a
    # JWT with aud='telemetry'. Operators flip this after mobile rollout.
    return _truthy("TELEMETRY_INGEST_AUDIENCE_REQUIRED")


def expected_audience() -> str:
    return os.getenv("TELEMETRY_INGEST_AUDIENCE", DEFAULT_AUDIENCE).strip() or DEFAULT_AUDIENCE


def jwt_secret() -> str | None:
    secret = os.getenv("TELEMETRY_INGEST_JWT_SECRET") or os.getenv("SECRET_KEY")
    return secret.strip() if secret else None


def _is_ingest_path(path: str) -> bool:
    return any(path == prefix or path.startswith(f"{prefix}/") for prefix in INGEST_PREFIXES)


def _decode_bearer(token: str, secret: str) -> dict | None:
    """Decode and verify signature + exp without validating the ``aud`` claim."""
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


def _validated_bearer_claims(
    token: str,
    secret: str,
    audience: str,
) -> tuple[dict | None, str | None]:
    claims = _decode_bearer(token, secret)
    if claims is None:
        return None, "invalid"
    if audience_required():
        aud = claims.get("aud")
        if isinstance(aud, list):
            ok = audience in aud
        elif isinstance(aud, str):
            ok = aud == audience
        else:
            ok = False
        if not ok:
            return None, "aud"
    return claims, None


def _validate_bearer_with_audience(
    token: str,
    secret: str,
    audience: str,
) -> tuple[bool, str | None]:
    claims, reason = _validated_bearer_claims(token, secret, audience)
    return claims is not None, reason


def current_ingest_claims() -> dict | None:
    return _request_ingest_claims.get()


def validate_ingest_claim_scope(
    claims: dict | None,
    *,
    activity_id: int | None,
    user_ids: Iterable[int | None],
    require_scope: bool | None = None,
) -> tuple[bool, str | None]:
    """Validate per-activity/per-user claims against normalized packet metadata."""
    if claims is None:
        return (not (require_scope if require_scope is not None else audience_required())), "claims"

    strict = audience_required() if require_scope is None else require_scope
    claim_activity = claims.get("activity_id")
    if claim_activity is None:
        if strict:
            return False, "activity"
    else:
        try:
            if activity_id is None or int(claim_activity) != int(activity_id):
                return False, "activity"
        except (TypeError, ValueError):
            return False, "activity"

    claim_sub = claims.get("sub")
    concrete_user_ids = {int(uid) for uid in user_ids if uid is not None}
    if claim_sub is None:
        if strict:
            return False, "user"
    else:
        try:
            subject = int(claim_sub)
        except (TypeError, ValueError):
            return False, "user"
        if concrete_user_ids and concrete_user_ids != {subject}:
            return False, "user"

    return True, None


def enforce_current_ingest_scope(
    *,
    activity_id: int | None,
    user_ids: Iterable[int | None],
) -> None:
    if not jwt_enforced():
        return
    ok, reason = validate_ingest_claim_scope(
        current_ingest_claims(),
        activity_id=activity_id,
        user_ids=user_ids,
    )
    if not ok:
        detail = "Telemetry token activity mismatch" if reason == "activity" else "Telemetry token user mismatch"
        raise HTTPException(status_code=403, detail=detail)


class IngestJwtMiddleware(BaseHTTPMiddleware):
    """Require and validate ingest JWTs when configured."""

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

        claims, reason = _validated_bearer_claims(token, secret, expected_audience())
        if claims is None:
            detail = "Invalid or expired token" if reason == "invalid" else "Audience mismatch"
            return JSONResponse(status_code=401, content={"detail": detail})

        context_token = _request_ingest_claims.set(claims)
        try:
            return await call_next(request)
        finally:
            _request_ingest_claims.reset(context_token)
