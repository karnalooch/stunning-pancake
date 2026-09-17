"""Django system checks for production hardening."""

from __future__ import annotations

from django.conf import settings
from django.core.checks import Error, Warning, register

from core.db_role_guard import UnsafeRuntimeDatabaseRole, assert_runtime_database_role_safe
from core.production_guards import is_production_runtime


@register(deploy=True)
def check_allowed_hosts_not_wildcard(app_configs, **kwargs):
    if not is_production_runtime(debug=settings.DEBUG):
        return []
    hosts = getattr(settings, "ALLOWED_HOSTS", [])
    if "*" in hosts:
        return [
            Warning(
                "ALLOWED_HOSTS is '*' in production — Host header attacks are possible.",
                hint="Set ALLOWED_HOSTS to your Railway/K8s domain(s), comma-separated.",
                id="core.W001",
            )
        ]
    return []


@register(deploy=True)
def check_runtime_database_role_cannot_bypass_rls(app_configs, **kwargs):
    """Block production deploys that would make FORCE RLS meaningless."""

    if not is_production_runtime(debug=settings.DEBUG):
        return []
    try:
        assert_runtime_database_role_safe()
    except Exception as exc:
        detail = str(exc) if isinstance(exc, UnsafeRuntimeDatabaseRole) else type(exc).__name__
        return [
            Error(
                f"Production database runtime role is not RLS-safe: {detail}",
                hint=(
                    "Use a dedicated PostgreSQL runtime role with NOSUPERUSER and "
                    "NOBYPASSRLS. Keep any privileged migration role separate from "
                    "the web/Celery DATABASE_URL."
                ),
                id="core.E002",
            )
        ]
    return []
