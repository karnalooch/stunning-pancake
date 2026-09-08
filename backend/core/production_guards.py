"""Production environment guards (testable, imported from settings)."""

from __future__ import annotations

import os
import warnings


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
