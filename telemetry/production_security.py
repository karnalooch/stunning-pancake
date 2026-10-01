"""Fail-closed startup authority for production/PaaS telemetry (#395)."""

from __future__ import annotations

import os

from ingest_auth import audience_required, jwt_enforced, jwt_secret

_ENVIRONMENT_MARKERS = ("SENTRY_ENVIRONMENT", "RAILWAY_ENVIRONMENT", "RAILWAY_ENVIRONMENT_NAME")
_PAAS_MARKERS = (
    "RAILWAY_SERVICE_NAME",
    "RAILWAY_SERVICE_ID",
    "RAILWAY_PROJECT_ID",
    "RAILWAY_ENVIRONMENT_ID",
    "DYNO",
    "RENDER",
    "RENDER_SERVICE_ID",
)


def production_security_required() -> bool:
    # Evaluate independently: a staging Sentry label must not mask a production
    # Railway environment. DEBUG, SKIP_DB and SKIP_BROADCAST are not bypasses.
    return any(
        os.getenv(name, "").strip().lower() in ("production", "prod")
        for name in _ENVIRONMENT_MARKERS
    ) or any(os.getenv(name, "").strip() for name in _PAAS_MARKERS)


def assert_production_security() -> None:
    """Reject unsafe runtime configuration before acquiring any resources."""
    if not production_security_required():
        return

    missing = []
    if not jwt_enforced():
        missing.append("TELEMETRY_INGEST_JWT_REQUIRED=1")
    if not audience_required():
        missing.append("TELEMETRY_INGEST_AUDIENCE_REQUIRED=1")
    secret = jwt_secret()
    if not secret or secret == "default-unsafe-key-for-dev":
        missing.append("usable TELEMETRY_INGEST_JWT_SECRET or shared SECRET_KEY")
    if missing:
        # Only setting names, never secret values, belong in startup diagnostics.
        raise RuntimeError("Production telemetry requires " + "; ".join(missing))
