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

import time

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser

from users.permissions import IsPlatformHealthViewer
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

START_TIME = time.time()


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

        return Response(
            {
                "nodes": citus_cluster_status(),
                "shards": citus_shard_status(),
            }
        )
    except Exception as exc:
        # Citus not installed — single node mode
        return Response(
            {
                "mode": "standalone",
                "note": "Citus extension not active. Run apply_citus_sharding() to enable.",
                "error": str(exc),
            }
        )


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

    return Response(
        {
            "status": overall,
            "redis": redis_status,
            "citus": citus_status,
        }
    )


class SystemHealthView(APIView):
    """
    Class-based view for comprehensive infrastructure health:
    Backend, PostgreSQL, Redis, Celery, Storage, Citus.
    GET /api/infra/health/
    """

    permission_classes = (IsPlatformHealthViewer,)

    def get(self, request):
        # -- Redis (existing) --
        from core.redis_cluster import health_check

        redis_status = health_check()

        # -- Citus (existing) --
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

        # -- PostgreSQL --
        try:
            from django.db import connection

            t0 = time.monotonic()
            connection.ensure_connection()
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            latency_ms = round((time.monotonic() - t0) * 1000, 2)
            pg_status = {"status": "ok", "latency_ms": latency_ms}
        except Exception as exc:
            pg_status = {"status": "error", "error": str(exc)}

        # -- Celery --
        try:
            from core.celery import app

            insp = app.control.inspect()
            stats = insp.stats()
            if stats:
                worker_count = len(stats)
                cel_status = {"status": "ok", "workers": worker_count}
            else:
                cel_status = {"status": "error", "error": "No workers responded"}
        except Exception as exc:
            err_msg = str(exc)
            # Sanitize leaked auth messages from broker (e.g. Redis password)
            if "authentication required" in err_msg.lower() or "noauth" in err_msg.lower():
                err_msg = "Broker requires authentication — check CELERY_BROKER_URL"
            elif "connection refused" in err_msg.lower():
                err_msg = "Broker unreachable — service may be down"
            cel_status = {"status": "error", "error": err_msg}

        # -- Storage --
        try:
            import psutil

            disk = psutil.disk_usage("/")
            storage_pct = disk.percent
            sto_status = {
                "status": "ok" if storage_pct < 90 else "warning",
                "usage_pct": storage_pct,
            }
        except ImportError:
            sto_status = {"status": "ok", "note": "psutil not installed"}
        except Exception as exc:
            sto_status = {"status": "error", "error": str(exc)}

        # -- Backend uptime --
        backend_status = {
            "status": "ok",
            "uptime_seconds": int(time.time() - START_TIME),
        }

        # -- Compute overall status --
        sub_statuses = [
            redis_status.get("status"),
            pg_status.get("status"),
            cel_status.get("status"),
            sto_status.get("status"),
            backend_status.get("status"),
        ]
        # "ok" if all are "ok", otherwise "degraded"
        overall = "ok" if all(s == "ok" for s in sub_statuses) else "degraded"

        return Response(
            {
                "status": overall,
                "backend": backend_status,
                "postgresql": pg_status,
                "redis": redis_status,
                "celery": cel_status,
                "storage": sto_status,
                "citus": citus_status,
            }
        )
