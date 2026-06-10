"""Django system checks for production hardening."""

from __future__ import annotations

from django.conf import settings
from django.core.checks import Warning, register

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
