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


def sim_lab_tenant() -> bool:
    """True on isolated sim-lab backend (not prod with proxy enabled)."""
    if os.getenv("SIM_LAB_ACCEPT_PROXY", "0").lower() in ("1", "true", "yes"):
        return True
    return (os.getenv("SENTRY_ENVIRONMENT") or "").strip().lower() == "sim-lab"


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


def _proxy_map_timeout(default: int = 28) -> int:
    try:
        return max(30, int(os.getenv("SIM_LAB_PROXY_MAP_TIMEOUT", str(default))))
    except (TypeError, ValueError):
        return default


def _build_url(admin_suffix: str) -> str:
    base = (os.getenv("SIM_LAB_PROXY_BASE_URL") or "").strip().rstrip("/")
    suffix = admin_suffix.lstrip("/")
    if not base.endswith("/api"):
        base = f"{base}/api"
    return f"{base}/activities/admin/{suffix}"


def _build_activities_url(suffix: str) -> str:
    base = (os.getenv("SIM_LAB_PROXY_BASE_URL") or "").strip().rstrip("/")
    suffix = suffix.lstrip("/")
    if not base.endswith("/api"):
        base = f"{base}/api"
    return f"{base}/activities/{suffix}"


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
    """Serialize outbound proxy body.

    DRF parses POST/PUT/PATCH into ``request.data`` before the view runs; reading
    ``request.body`` then raises RawPostDataException and surfaced as HTTP 500.
    """
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return None

    data = getattr(request, "data", None)
    if data is not None and data != {}:
        return json.dumps(data, default=str).encode("utf-8")

    try:
        raw = getattr(request, "_request", request)
        body = raw.body
    except Exception:
        body = b""

    if body:
        return body
    if request.method in ("POST", "PUT", "PATCH"):
        return b"{}"
    return None


def _forward_headers(request) -> dict[str, str]:
    headers = _proxy_headers(request)
    inm = (request.META.get("HTTP_IF_NONE_MATCH") or "").strip()
    if inm:
        headers["If-None-Match"] = inm
    accept = (request.META.get("HTTP_ACCEPT") or "").strip()
    if accept:
        headers["Accept"] = accept
    return headers


def _upstream_should_fallback(payload: Any, status_code: int) -> bool:
    if status_code >= 500:
        return True
    if isinstance(payload, dict):
        err = str(payload.get("error") or payload.get("detail") or "")
        if "Internal Server Error" in err:
            return True
    return False


def _forward_upstream(
    request,
    url: str,
    *,
    timeout: int,
    passthrough_status: bool = False,
    allow_local_fallback: bool = False,
) -> Response | None:
    headers = _forward_headers(request)
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
        if allow_local_fallback:
            return None
        return Response(
            {
                "error": "Sim-lab proxy unreachable. Check SIM_LAB_PROXY_* on backend.",
                "detail": str(exc),
                "sim_lab_proxy": True,
            },
            status=503,
        )

    if passthrough_status and upstream.status_code == 304:
        resp = Response(status=304)
        etag = upstream.headers.get("ETag")
        if etag:
            resp["ETag"] = etag
        cache = upstream.headers.get("Cache-Control")
        if cache:
            resp["Cache-Control"] = cache
        return resp

    try:
        payload = upstream.json() if upstream.content else {}
    except json.JSONDecodeError:
        payload = {"error": upstream.text or "Non-JSON sim-lab response", "sim_lab_proxy": True}

    if allow_local_fallback and _upstream_should_fallback(payload, upstream.status_code):
        logger.warning(
            "sim-lab proxy %s returned %s — falling back to local handler",
            url,
            upstream.status_code,
        )
        return None

    if isinstance(payload, dict):
        payload.setdefault("sim_lab_proxy", True)

    resp = Response(payload, status=upstream.status_code)
    if passthrough_status:
        etag = upstream.headers.get("ETag")
        if etag:
            resp["ETag"] = etag
        cache = upstream.headers.get("Cache-Control")
        if cache:
            resp["Cache-Control"] = cache
    return resp


def _skip_sim_lab_proxy(request) -> bool:
    """Allow destructive/local ops on prod DB when explicitly requested."""
    if request.query_params.get("local") in ("1", "true", "yes"):
        return True
    data = getattr(request, "data", None) or {}
    if isinstance(data, dict) and data.get("force_local") in (True, "true", "1", 1):
        return True
    return False


def try_forward_sim_lab(request, admin_suffix: str, *, timeout: int = 90) -> Response | None:
    """Return DRF Response when proxied; None to handle locally."""
    if not sim_lab_proxy_enabled() or _skip_sim_lab_proxy(request):
        return None

    url = _build_url(admin_suffix) + _query_string(request)
    return _forward_upstream(request, url, timeout=timeout)


def try_forward_sim_lab_activities(
    request,
    activities_suffix: str,
    *,
    timeout: int | None = None,
    allow_local_fallback: bool = False,
) -> Response | None:
    """Forward telemetry/live and related activity endpoints to sim-lab."""
    if not sim_lab_proxy_enabled():
        return None

    effective_timeout = timeout if timeout is not None else _proxy_map_timeout()
    url = _build_activities_url(activities_suffix) + _query_string(request)
    return _forward_upstream(
        request,
        url,
        timeout=effective_timeout,
        passthrough_status=True,
        allow_local_fallback=allow_local_fallback,
    )


def assert_prod_heavy_sim_allowed(
    *,
    total_users: int | None = None,
    target_active: int | None = None,
) -> Response | None:
    """Block heavy sim on prod when proxy is off. Return error Response or None."""
    if sim_lab_proxy_enabled() or sim_lab_tenant():
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
