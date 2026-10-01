"""Production environment guards (testable, imported from settings)."""

from __future__ import annotations

import os
import warnings

_DEFAULT_UNSAFE_SECRET_KEY = "default-unsafe-key-for-dev"


def resolve_secret_key(raw: str | None, *, debug: bool) -> str:
    """Require persistent explicit signing authority outside local DEBUG mode."""
    if not debug and (not raw or not raw.strip() or raw.strip() == _DEFAULT_UNSAFE_SECRET_KEY):
        raise RuntimeError(
            "SECRET_KEY must be set in production. Set the SECRET_KEY environment variable."
        )
    # Keep explicit keys byte-for-byte, and preserve the existing local default.
    return _DEFAULT_UNSAFE_SECRET_KEY if raw is None else raw


def parse_allowed_hosts(raw: str | None) -> list[str]:
    if not raw or not raw.strip():
        return ["*"]
    hosts = [h.strip() for h in raw.split(",") if h.strip()]
    return hosts or ["*"]


def is_paas_runtime() -> bool:
    return bool(os.getenv("RAILWAY_SERVICE_NAME") or os.getenv("DYNO") or os.getenv("RENDER"))


def is_production_runtime(*, debug: bool) -> bool:
    if debug:
        return False
    env = (
        (os.getenv("SENTRY_ENVIRONMENT") or os.getenv("RAILWAY_ENVIRONMENT") or "").strip().lower()
    )
    if env in ("production", "prod"):
        return True
    return is_paas_runtime()


def warn_insecure_allowed_hosts(hosts: list[str], *, debug: bool) -> None:
    if not is_production_runtime(debug=debug):
        return
    if "*" in hosts:
        warnings.warn(
            "ALLOWED_HOSTS contains '*' in production — set explicit hostnames "
            "(e.g. your-app.up.railway.app).",
            stacklevel=2,
        )
