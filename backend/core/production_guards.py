"""Production environment guards (testable, imported from settings)."""

from __future__ import annotations

import os
import warnings

DEV_SECRET_KEY = "default-unsafe-key-for-dev"


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


def resolve_secret_key(raw: str | None, *, debug: bool) -> str:
    """Return the configured signing key or fail closed outside development."""
    value = (raw or "").strip()
    if debug:
        return value or DEV_SECRET_KEY
    if not value or value == DEV_SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY must be set in production. "
            "Set a stable SECRET_KEY environment variable before startup."
        )
    return value
