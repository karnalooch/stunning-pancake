"""
Infrastructure Health API — SPORT Platform (Hyperscale)
=========================================================
Monitoring endpoints for Redis Cluster and Citus topology.

Endpoints:
    GET /api/infra/health/redis/   → Redis cluster status + latency
    GET /api/infra/health/citus/   → Citus coordinator + worker nodes
    GET /api/infra/health/         → Combined health summary

Access: Admin only (IsAdminUser permission).
"""
from __future__ import annotations

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.request import Request
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([IsAdminUser])
def redis_health_view(request: Request) -> Response:
    """Returns Redis Cluster topology and latency."""
    from core.redis_cluster import health_check
    return Response(health_check())


@api_view(["GET"])
@permission_classes([IsAdminUser])
def citus_health_view(request: Request) -> Response:
    """Returns Citus node topology and shard distribution."""
    try:
        from core.citus import citus_cluster_status, citus_shard_status
        return Response({
            "nodes": citus_cluster_status(),
            "shards": citus_shard_status(),
        })
    except Exception as exc:
        # Citus not installed — single node mode
        return Response({
            "mode": "standalone",
            "note": "Citus extension not active. Run apply_citus_sharding() to enable.",
            "error": str(exc),
        })


@api_view(["GET"])
@permission_classes([IsAdminUser])
def infra_health_view(request: Request) -> Response:
    """Combined infrastructure health: Redis + Citus."""
    from core.redis_cluster import health_check

    redis_status = health_check()

    try:
        from core.citus import citus_cluster_status
        citus_nodes = citus_cluster_status()
        citus_status = {
            "mode": "cluster" if len(citus_nodes) > 1 else "standalone",
            "nodes": len(citus_nodes),
            "workers": len([n for n in citus_nodes if n.get("role") == "worker"]),
        }
    except Exception:
        citus_status = {"mode": "standalone"}

    overall = "ok" if redis_status.get("status") in ("ok", "online") else "degraded"

    return Response({
        "status": overall,
        "redis": redis_status,
        "citus": citus_status,
    })
