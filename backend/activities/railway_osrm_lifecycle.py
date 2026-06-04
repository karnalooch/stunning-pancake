"""
Scale Railway OSRM service (numReplicas 0↔1) with live simulator start/stop.

No redeploy — uses Railway GraphQL serviceInstanceUpdate.
Requires RAILWAY_API_TOKEN on backend (Railway Variables, not in git).
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

RAILWAY_GRAPHQL = "https://backboard.railway.com/graphql/v2"
DEFAULT_PROJECT_ID = "ce13089b-76f4-4114-a892-ad13e23c8761"
DEFAULT_ENVIRONMENT_ID = "f30e70a7-b4d2-42aa-8137-21faa091b969"
DEFAULT_SERVICE_NAME = "osrm"
DEFAULT_OSRM_REGION = "europe-west4-drams3a"

_SERVICE_ID_CACHE: str | None = None


@dataclass(frozen=True)
class OsrmScaleResult:
    action: str  # scaled_up | scaled_down | skipped | failed
    replicas: int | None = None
    detail: str | None = None


def _lifecycle_explicitly_disabled() -> bool:
    raw = (os.getenv("RAILWAY_OSRM_LIFECYCLE") or "").strip().lower()
    return raw in ("0", "false", "no", "off")


def _lifecycle_explicitly_enabled() -> bool:
    raw = (os.getenv("RAILWAY_OSRM_LIFECYCLE") or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def lifecycle_enabled() -> bool:
    """True when backend should scale OSRM with live sim (not local SQLite)."""
    if _lifecycle_explicitly_disabled():
        return False
    if "sqlite" in (os.getenv("DATABASE_URL") or "").lower():
        return False
    if not (os.getenv("RAILWAY_API_TOKEN") or "").strip():
        return False
    if _lifecycle_explicitly_enabled():
        return True
    # Default: on when token present (prod backend with Railway vars).
    return True


def _sim_wants_osrm() -> bool:
    from activities.sim_routing import sim_routing_backend

    return sim_routing_backend() in ("osrm", "auto")


def _gql(query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
    token = (os.getenv("RAILWAY_API_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("RAILWAY_API_TOKEN missing")
    body: dict[str, Any] = {"query": query}
    if variables:
        body["variables"] = variables
    req = urllib.request.Request(
        RAILWAY_GRAPHQL,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode() if exc.fp else ""
        raise RuntimeError(f"Railway HTTP {exc.code}: {err_body[:500]}") from exc
    if payload.get("errors"):
        raise RuntimeError(json.dumps(payload["errors"])[:500])
    return payload


def _environment_id() -> str:
    return (os.getenv("RAILWAY_ENVIRONMENT_ID") or DEFAULT_ENVIRONMENT_ID).strip()


def _project_id() -> str:
    return (os.getenv("RAILWAY_PROJECT_ID") or DEFAULT_PROJECT_ID).strip()


def _service_name() -> str:
    return (os.getenv("RAILWAY_OSRM_SERVICE_NAME") or DEFAULT_SERVICE_NAME).strip()


def _osrm_region() -> str:
    return (os.getenv("RAILWAY_OSRM_REGION") or DEFAULT_OSRM_REGION).strip()


def resolve_osrm_service_id() -> str:
    """Service UUID for GraphQL (env override or project lookup by name)."""
    global _SERVICE_ID_CACHE
    explicit = (os.getenv("RAILWAY_OSRM_SERVICE_ID") or "").strip()
    if explicit:
        return explicit
    if _SERVICE_ID_CACHE:
        return _SERVICE_ID_CACHE

    query = """
    query($projectId: String!) {
      project(id: $projectId) {
        services {
          edges {
            node { id name }
          }
        }
      }
    }
    """
    data = _gql(query, {"projectId": _project_id()})
    edges = (data.get("data") or {}).get("project", {}) or {}
    edges = edges.get("services", {}) or {}
    name = _service_name()
    for edge in edges.get("edges") or []:
        node = edge.get("node") or {}
        if (node.get("name") or "").strip() == name:
            sid = node.get("id")
            if sid:
                _SERVICE_ID_CACHE = sid
                return sid
    raise RuntimeError(f"Railway service not found: {name!r} in project {_project_id()}")


def set_osrm_replicas(replicas: int) -> bool:
    """
    Scale OSRM via multiRegionConfig (top-level numReplicas rejects 0 on Railway).
    Triggers serviceInstanceRedeploy so runtime matches config (same as CLI scale).
    """
    region = _osrm_region()
    update_mutation = """
    mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }
    """
    variables = {
        "serviceId": resolve_osrm_service_id(),
        "environmentId": _environment_id(),
        "input": {"multiRegionConfig": {region: {"numReplicas": replicas}}},
    }
    out = _gql(update_mutation, variables)
    ok = (out.get("data") or {}).get("serviceInstanceUpdate")
    if ok is not True and ok is not False:
        logger.warning("serviceInstanceUpdate unexpected payload: %s", ok)

    redeploy_mutation = """
    mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }
    """
    redeploy = _gql(
        redeploy_mutation,
        {"serviceId": variables["serviceId"], "environmentId": variables["environmentId"]},
    )
    redeploy_ok = (redeploy.get("data") or {}).get("serviceInstanceRedeploy")
    return bool(ok) and redeploy_ok is not False


def scale_osrm_for_live_sim(*, running: bool) -> OsrmScaleResult:
    """
    running=True  → numReplicas 1 (before / with live sim start)
    running=False → numReplicas 0 (after live sim stop)
    """
    if not lifecycle_enabled():
        return OsrmScaleResult(action="skipped", detail="lifecycle_disabled")
    if running and not _sim_wants_osrm():
        return OsrmScaleResult(action="skipped", detail="routing_backend_not_osrm")

    replicas = 1 if running else 0
    try:
        set_osrm_replicas(replicas)
        action = "scaled_up" if running else "scaled_down"
        return OsrmScaleResult(action=action, replicas=replicas)
    except Exception as exc:
        logger.exception("Railway OSRM scale to %s failed", replicas)
        return OsrmScaleResult(action="failed", replicas=replicas, detail=str(exc)[:300])


def osrm_lifecycle_echo() -> dict[str, Any]:
    """Small dict for API responses / live state debugging."""
    return {
        "enabled": lifecycle_enabled(),
        "wants_osrm": _sim_wants_osrm(),
        "service_name": _service_name(),
    }
