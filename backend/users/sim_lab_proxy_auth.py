"""
Authenticate proxied simulator requests from production backend (sim-lab only).
"""

from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from activities.sim_lab_proxy import PROXY_ACTOR_HEADER, PROXY_HEADER


class SimLabProxyAuthentication(BaseAuthentication):
    """Validates X-Sim-Lab-Proxy-Token and impersonates the named admin user."""

    def authenticate(self, request):
        if os.getenv("SIM_LAB_ACCEPT_PROXY", "0").lower() not in ("1", "true", "yes"):
            return None

        token = (request.headers.get(PROXY_HEADER) or "").strip()
        if not token:
            return None

        expected = (os.getenv("SIM_LAB_PROXY_SECRET") or "").strip()
        if not expected or token != expected:
            raise AuthenticationFailed("Invalid sim-lab proxy token")

        actor = (request.headers.get(PROXY_ACTOR_HEADER) or "global_owner").strip()
        User = get_user_model()
        user = User.objects.filter(username=actor, is_active=True).first()
        if not user:
            raise AuthenticationFailed(f"Proxy actor not found: {actor}")

        return (user, "sim-lab-proxy")
