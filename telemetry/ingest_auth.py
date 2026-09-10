"""Optional JWT gate for telemetry ingest (ADR 011 / Q-P2-1)."""

from __future__ import annotations

import os
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

INGEST_PREFIXES = ("/api/telemetry/ingest",)


def _truthy(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes")


def jwt_enforced() -> bool:
    return _truthy("TELEMETRY_INGEST_JWT_REQUIRED")


def jwt_secret() -> str | None:
    secret = os.getenv("TELEMETRY_INGEST_JWT_SECRET") or os.getenv("SECRET_KEY")
    return secret.strip() if secret else None


def _is_ingest_path(path: str) -> bool:
    return any(path == prefix or path.startswith(f"{prefix}/") for prefix in INGEST_PREFIXES)


def _validate_bearer(token: str, secret: str) -> bool:
    try:
        import jwt
    except ImportError:
        return False

    try:
        jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"require": ["exp"]},
        )
        return True
    except Exception:
        return False


class IngestJwtMiddleware(BaseHTTPMiddleware):
    """When TELEMETRY_INGEST_JWT_REQUIRED=1, ingest POSTs need Bearer JWT."""

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
        if not token or not _validate_bearer(token, secret):
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})

        return await call_next(request)
