"""
Forward admin simulator API calls from production backend to sim-lab.

Keeps prod Postgres/Celery free while the admin UI still talks to the prod API URL.
"""

from __future__ import annotations

import json
import logging
import os
import time
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


def sim_lab_read_federation_enabled() -> bool:
    """When true, prod BFF federates read-only admin KPIs (e.g. admin/stats) to sim-lab."""
    if not sim_lab_proxy_enabled():
        return False
    from activities.sim_integration_mode import sim_prod_local_writes

    if sim_prod_local_writes():
        return False
    return os.getenv("SIM_LAB_READ_FEDERATION_ENABLED", "0").lower() in ("1", "true", "yes")


def dashboard_data_source() -> str:
    from activities.sim_integration_mode import sim_prod_local_writes

    if sim_prod_local_writes():
        return "production"
    if sim_lab_read_federation_enabled():
        return "sim-lab"
    return "production"


def annotate_federated_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Mark response as synthetic sim-lab data (read federation contract)."""
    if payload.get("integration_test_mode"):
        return annotate_production_payload(payload)
    label = sim_lab_proxy_public_label() or "sim-lab"
    payload["data_source"] = "sim-lab"
    payload["synthetic"] = True
    payload["sim_lab_proxy"] = True
    payload["sim_lab_label"] = label
    return payload


def annotate_production_payload(payload: dict[str, Any]) -> dict[str, Any]:
    payload["data_source"] = "production"
    payload["synthetic"] = False
    return payload


_HEALTH_CACHE: dict[str, Any] = {}
_HEALTH_CACHE_TTL_OK_SECONDS = 5.0
_HEALTH_CACHE_TTL_FAIL_SECONDS = 15.0

_INTEGRATION_TARGET_CACHE: dict[str, Any] = {}
_INTEGRATION_TARGET_CACHE_TTL_SECONDS = 30.0

_STATS_FEDERATION_CACHE: dict[str, Any] = {}


def _health_cache_ttl(*, reachable: bool) -> float:
    if reachable:
        return _HEALTH_CACHE_TTL_OK_SECONDS
    try:
        return float(os.getenv("SIM_LAB_PROXY_HEALTH_FAIL_CACHE_TTL", str(_HEALTH_CACHE_TTL_FAIL_SECONDS)))
    except (TypeError, ValueError):
        return _HEALTH_CACHE_TTL_FAIL_SECONDS


def _proxy_headers_system() -> dict[str, str]:
    secret = (os.getenv("SIM_LAB_PROXY_SECRET") or "").strip()
    return {
        PROXY_HEADER: secret,
        PROXY_ACTOR_HEADER: "system",
        PROXY_FROM_HEADER: os.getenv("SENTRY_ENVIRONMENT", "production"),
        "Accept": "application/json",
    }


def probe_sim_lab_health(*, timeout: float | None = None, force: bool = False) -> dict[str, Any]:
    """Quick reachability probe for sim-lab (cached a few seconds on prod)."""
    if not sim_lab_proxy_enabled():
        return {"reachable": True, "mode": "local"}

    now = time.time()
    cached = _HEALTH_CACHE.get("probe")
    if not force and isinstance(cached, dict):
        ttl = float(cached.get("_ttl") or _HEALTH_CACHE_TTL_OK_SECONDS)
        if now - float(cached.get("_ts") or 0) < ttl:
            return {k: v for k, v in cached.items() if k not in ("_ts", "_ttl")}

    effective_timeout = timeout
    if effective_timeout is None:
        try:
            effective_timeout = float(os.getenv("SIM_LAB_PROXY_HEALTH_TIMEOUT", "8"))
        except (TypeError, ValueError):
            effective_timeout = 8.0

    url = _health_url()
    started = time.time()
    try:
        upstream = requests.get(url, timeout=effective_timeout)
        latency_ms = round((time.time() - started) * 1000)
        reachable = upstream.status_code < 500
        err_text = (upstream.text or "")[:160] or None
        if not reachable and upstream.status_code in (502, 503, 504):
            err_text = err_text or f"HTTP {upstream.status_code} (sim-lab restarting or overloaded)"
        result: dict[str, Any] = {
            "reachable": reachable,
            "latency_ms": latency_ms,
            "status_code": upstream.status_code,
            "error": None if reachable else err_text,
        }
    except requests.RequestException as exc:
        result = {
            "reachable": False,
            "latency_ms": round((time.time() - started) * 1000),
            "status_code": None,
            "error": str(exc)[:160],
        }

    _HEALTH_CACHE["probe"] = {
        **result,
        "_ts": now,
        "_ttl": _health_cache_ttl(reachable=bool(result.get("reachable"))),
    }
    return result


def clear_integration_target_cache() -> None:
    _INTEGRATION_TARGET_CACHE.clear()


def _integration_mode_defaults(*, editable: bool = False) -> dict[str, Any]:
    return {
        "integration_test_mode": False,
        "integration_test_env_default": False,
        "integration_test_redis_override": False,
        "integration_test_editable": editable,
    }


def _integration_mode_target_fields(*, health: dict[str, Any] | None = None) -> dict[str, Any]:
    from activities.sim_integration_mode import integration_test_mode_info

    if sim_lab_tenant():
        out = integration_test_mode_info()
        out["integration_test_editable"] = True
        return out
    if not sim_lab_proxy_enabled():
        return _integration_mode_defaults()

    now = time.time()
    cached = _INTEGRATION_TARGET_CACHE.get("fields")
    if isinstance(cached, dict) and now - float(cached.get("_ts") or 0) < _INTEGRATION_TARGET_CACHE_TTL_SECONDS:
        return {k: v for k, v in cached.items() if k != "_ts"}

    if health is not None and not health.get("reachable"):
        return _integration_mode_defaults()

    remote = fetch_sim_lab_admin_json("integration-test-mode/", health=health) or {}
    if not remote:
        return _integration_mode_defaults()
    fields = {
        "integration_test_mode": bool(remote.get("enabled")),
        "integration_test_env_default": bool(remote.get("env_default")),
        "integration_test_redis_override": bool(remote.get("redis_override")),
        "integration_test_editable": bool(remote.get("editable")),
    }
    _INTEGRATION_TARGET_CACHE["fields"] = {**fields, "_ts": now}
    return fields


def sim_lab_proxy_target_info(*, include_health: bool = True) -> dict[str, Any]:
    from activities.sim_integration_mode import prod_local_writes_info, sim_prod_local_writes

    enabled = sim_lab_proxy_enabled()
    prod_local = sim_prod_local_writes()
    federation = sim_lab_read_federation_enabled()
    health = probe_sim_lab_health() if include_health and enabled and not prod_local else None
    integration = _integration_mode_target_fields(health=health)
    data_source = dashboard_data_source()
    if integration.get("integration_test_mode") and federation:
        data_source = "production"
    if enabled and prod_local:
        proxy_mode = "prod-local-sim"
    elif enabled:
        proxy_mode = "sim-lab-proxy"
    else:
        proxy_mode = "local"
    info: dict[str, Any] = {
        "mode": proxy_mode,
        "sim_lab_label": sim_lab_proxy_public_label() if enabled else None,
        "sim_lab_base_url": (os.getenv("SIM_LAB_PROXY_BASE_URL") or "").strip().rstrip("/")
        if enabled
        else None,
        "prod_heavy_sim_guard": not enabled
        and os.getenv("ALLOW_PROD_HEAVY_SIM", "0") not in ("1", "true", "yes"),
        "read_federation_enabled": federation,
        "dashboard_data_source": data_source,
        **integration,
        **prod_local_writes_info(),
    }
    if health is not None:
        info["sim_lab_health"] = health
    return info


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


def _proxy_stats_timeout(default: int = 15) -> int:
    try:
        return max(3, int(os.getenv("SIM_LAB_PROXY_STATS_TIMEOUT", str(default))))
    except (TypeError, ValueError):
        return default


def _proxy_stats_cache_ttl() -> int:
    try:
        return max(0, int(os.getenv("SIM_LAB_PROXY_STATS_CACHE_TTL", "30")))
    except (TypeError, ValueError):
        return 30


def _stats_federation_cache_key(request) -> str:
    user = getattr(request, "user", None)
    scoped = str(getattr(user, "tenant_id", None) or "")
    role = str(getattr(user, "role", None) or "")
    return f"{role}:{scoped}:{_query_string(request)}"


def _proxy_base_url() -> str:
    return (os.getenv("SIM_LAB_PROXY_BASE_URL") or "").strip().rstrip("/")


def _health_url() -> str:
    """Lightweight liveness URL (avoids queuing behind heavy admin/telemetry on sim-lab)."""
    return f"{_proxy_base_url()}/health/"


def _build_url(admin_suffix: str) -> str:
    base = _proxy_base_url()
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


def try_forward_sim_lab(
    request,
    admin_suffix: str,
    *,
    timeout: int = 90,
    allow_local_fallback: bool = False,
) -> Response | None:
    """Return DRF Response when proxied; None to handle locally."""
    from activities.sim_integration_mode import sim_prod_local_writes

    if not sim_lab_proxy_enabled() or _skip_sim_lab_proxy(request) or sim_prod_local_writes():
        return None

    if allow_local_fallback and request.method in ("GET", "HEAD"):
        health = probe_sim_lab_health()
        if not health.get("reachable"):
            logger.info("sim-lab proxy skip %s — health unreachable", admin_suffix)
            return None

    url = _build_url(admin_suffix) + _query_string(request)
    return _forward_upstream(
        request,
        url,
        timeout=timeout,
        allow_local_fallback=allow_local_fallback,
    )


def sim_lab_unreachable_response(*, action: str = "simulator") -> Response:
    """503 when sim-lab proxy is on but upstream is down (mutating ops)."""
    health = probe_sim_lab_health(force=True)
    return Response(
        {
            "error": (
                f"Sim-lab unreachable. Cannot {action} until sim-lab recovers "
                "or SIM_LAB_PROXY is disabled."
            ),
            "code": "SIM_LAB_UNREACHABLE",
            "sim_lab_health": health,
            "sim_lab_proxy": True,
        },
        status=503,
    )


def require_sim_lab_reachable() -> Response | None:
    """Return error Response when proxy enabled but sim-lab is down; else None."""
    from activities.sim_integration_mode import sim_prod_local_writes

    if not sim_lab_proxy_enabled() or sim_prod_local_writes():
        return None
    if probe_sim_lab_health().get("reachable"):
        return None
    return sim_lab_unreachable_response()


def try_forward_sim_lab_read(
    request,
    admin_suffix: str,
    *,
    timeout: int | None = None,
    allow_local_fallback: bool = False,
) -> Response | None:
    """Forward read-only admin GET endpoints to sim-lab (dashboard federation)."""
    if request.method not in ("GET", "HEAD"):
        return None
    if not sim_lab_read_federation_enabled() or _skip_sim_lab_proxy(request):
        return None

    effective_timeout = timeout if timeout is not None else _proxy_stats_timeout()
    refresh = getattr(request, "query_params", {}).get("refresh") == "1"
    cache_ttl = _proxy_stats_cache_ttl()
    cache_key = _stats_federation_cache_key(request)

    if not refresh and cache_ttl > 0:
        cached = _STATS_FEDERATION_CACHE.get(cache_key)
        if isinstance(cached, dict) and time.time() - float(cached.get("_ts") or 0) < cache_ttl:
            payload = dict(cached.get("payload") or {})
            return Response(payload, status=int(cached.get("status_code") or 200))

    url = _build_url(admin_suffix) + _query_string(request)
    proxied = _forward_upstream(
        request,
        url,
        timeout=effective_timeout,
        allow_local_fallback=allow_local_fallback,
    )
    if proxied is None:
        return None

    if isinstance(proxied.data, dict):
        annotate_federated_payload(proxied.data)
        if proxied.status_code == 200 and cache_ttl > 0 and not refresh:
            _STATS_FEDERATION_CACHE[cache_key] = {
                "payload": dict(proxied.data),
                "status_code": proxied.status_code,
                "_ts": time.time(),
            }
    return proxied


def try_forward_sim_lab_activities(
    request,
    activities_suffix: str,
    *,
    timeout: int | None = None,
    allow_local_fallback: bool = False,
) -> Response | None:
    """Forward telemetry/live and related activity endpoints to sim-lab."""
    from activities.sim_integration_mode import sim_prod_local_writes

    if not sim_lab_proxy_enabled() or sim_prod_local_writes():
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


def fetch_sim_lab_admin_json(
    admin_suffix: str,
    *,
    query: str = "",
    timeout: float | None = None,
    health: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """System GET to sim-lab admin API (dashboard sim_kpi federation)."""
    if not sim_lab_proxy_enabled():
        return None
    probe = health if health is not None else probe_sim_lab_health()
    if not probe.get("reachable"):
        return None

    effective_timeout = timeout if timeout is not None else float(_proxy_stats_timeout())
    url = _build_url(admin_suffix)
    if query:
        url += query if query.startswith("?") else f"?{query}"

    try:
        upstream = requests.get(
            url,
            headers=_proxy_headers_system(),
            timeout=effective_timeout,
        )
    except requests.RequestException as exc:
        logger.warning("sim-lab admin fetch failed %s: %s", url, exc)
        return None

    if upstream.status_code >= 500:
        return None
    try:
        payload = upstream.json() if upstream.content else {}
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def assert_prod_heavy_sim_allowed(
    *,
    total_users: int | None = None,
    target_active: int | None = None,
) -> Response | None:
    """Block heavy sim on prod when proxy is off. Return error Response or None."""
    from activities.sim_integration_mode import sim_prod_local_writes

    if sim_lab_tenant() or sim_prod_local_writes() or sim_lab_proxy_enabled():
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
