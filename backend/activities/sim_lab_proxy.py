"""
Forward admin simulator API calls from production backend to sim-lab.

Keeps prod Postgres/Celery free while the admin UI still talks to the prod API URL.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import requests
from django.http import QueryDict
from rest_framework.response import Response

logger = logging.getLogger(__name__)

PROXY_HEADER = "X-Sim-Lab-Proxy-Token"
PROXY_ACTOR_HEADER = "X-Sim-Lab-Proxy-Actor"
PROXY_FROM_HEADER = "X-Sim-Lab-Proxy-From"


def sim_lab_proxy_enabled() -> bool:
    base = (os.getenv("SIM_LAB_PROXY_BASE_URL") or "").strip()
    secret = (os.getenv("SIM_LAB_PROXY_SECRET") or "").strip()
    return os.getenv("SIM_LAB_PROXY_ENABLED", "0").lower() in ("1", "true", "yes") and bool(
        base and secret
    )


def sim_lab_proxy_public_label() -> str | None:
    if not sim_lab_proxy_enabled():
        return None
    return (os.getenv("SIM_LAB_PROXY_PUBLIC_LABEL") or "sim-lab").strip() or "sim-lab"


def sim_lab_proxy_target_info() -> dict[str, Any]:
    enabled = sim_lab_proxy_enabled()
    return {
        "mode": "sim-lab-proxy" if enabled else "local",
        "sim_lab_label": sim_lab_proxy_public_label() if enabled else None,
        "sim_lab_base_url": (os.getenv("SIM_LAB_PROXY_BASE_URL") or "").strip().rstrip("/")
        if enabled
        else None,
        "prod_heavy_sim_guard": not enabled
        and os.getenv("ALLOW_PROD_HEAVY_SIM", "0") not in ("1", "true", "yes"),
    }


def _proxy_headers(request) -> dict[str, str]:
    secret = (os.getenv("SIM_LAB_PROXY_SECRET") or "").strip()
    actor = getattr(getattr(request, "user", None), "username", None) or "global_owner"
    headers = {
        PROXY_HEADER: secret,
        PROXY_ACTOR_HEADER: actor,
        PROXY_FROM_HEADER: os.getenv("SENTRY_ENVIRONMENT", "production"),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    return headers


def _build_url(admin_suffix: str) -> str:
    base = (os.getenv("SIM_LAB_PROXY_BASE_URL") or "").strip().rstrip("/")
    suffix = admin_suffix.lstrip("/")
    if not base.endswith("/api"):
        base = f"{base}/api"
    return f"{base}/activities/admin/{suffix}"


def _query_string(request) -> str:
    if not request.GET:
        return ""
    q = QueryDict("", mutable=True)
    for key, values in request.GET.lists():
        for value in values:
            q.appendlist(key, value)
    encoded = q.urlencode()
    return f"?{encoded}" if encoded else ""


def _request_body(request) -> bytes | None:
    if request.method in ("GET", "DELETE") and not request.body:
        return None
    if not request.body:
        return None
    return request.body


def try_forward_sim_lab(request, admin_suffix: str, *, timeout: int = 90) -> Response | None:
    """Return DRF Response when proxied; None to handle locally."""
    if not sim_lab_proxy_enabled():
        return None

    url = _build_url(admin_suffix) + _query_string(request)
    headers = _proxy_headers(request)
    body = _request_body(request)

    try:
        upstream = requests.request(
            method=request.method,
            url=url,
            headers=headers,
            data=body,
            timeout=timeout,
        )
    except requests.RequestException as exc:
        logger.warning("sim-lab proxy failed %s %s: %s", request.method, url, exc)
        return Response(
            {
                "error": "Sim-lab proxy unreachable. Check SIM_LAB_PROXY_* on backend.",
                "detail": str(exc),
                "sim_lab_proxy": True,
            },
            status=503,
        )

    try:
        payload = upstream.json() if upstream.content else {}
    except json.JSONDecodeError:
        payload = {"error": upstream.text or "Non-JSON sim-lab response", "sim_lab_proxy": True}

    if isinstance(payload, dict):
        payload.setdefault("sim_lab_proxy", True)

    return Response(payload, status=upstream.status_code)


def assert_prod_heavy_sim_allowed(
    *,
    total_users: int | None = None,
    target_active: int | None = None,
) -> Response | None:
    """Block heavy sim on prod when proxy is off. Return error Response or None."""
    if sim_lab_proxy_enabled():
        return None
    if os.getenv("ALLOW_PROD_HEAVY_SIM", "0").lower() in ("1", "true", "yes"):
        return None

    from activities.scale_config import _int

    max_batch = _int("PROD_MAX_BATCH_USERS", 10_000)
    max_active = _int("PROD_MAX_LIVE_ACTIVE", 5_000)

    if total_users is not None and total_users > max_batch:
        return Response(
            {
                "error": (
                    f"Heavy batch sim blocked on production (>{max_batch:,} users). "
                    "Enable SIM_LAB_PROXY on backend or use sim-lab scripts."
                ),
                "code": "PROD_HEAVY_SIM_BLOCKED",
                "limit": max_batch,
            },
            status=403,
        )

    if target_active is not None and target_active > max_active:
        return Response(
            {
                "error": (
                    f"Heavy live sim blocked on production (>{max_active:,} ACTIVE). "
                    "Enable SIM_LAB_PROXY on backend."
                ),
                "code": "PROD_HEAVY_SIM_BLOCKED",
                "limit": max_active,
            },
            status=403,
        )
    return None
