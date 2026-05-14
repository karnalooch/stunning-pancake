"""
Redis Cluster Manager — SPORT Platform (Hyperscale)
======================================================
Constitution §21.3: Distributed Cache Infrastructure

Replaces the single Redis instance with a 6-node Redis Cluster
(3 masters + 3 replicas), providing:
- Horizontal data sharding across 16,384 hash slots
- Automatic failover (replica promotes to master in <1s)
- 3x read throughput via replica routing

Topology:
  Master-1 (slots 0-5460)      ←→ Replica-1
  Master-2 (slots 5461-10922)  ←→ Replica-2
  Master-3 (slots 10923-16383) ←→ Replica-3

IMPORTANT — Hash Tags:
  Redis Cluster requires keys that cross multiple slots to use
  hash tags: {city_id}:leaderboard. All keys in this module
  already follow this convention.

Usage:
  from core.redis_cluster import get_redis, get_pipeline

  r = get_redis()
  p = get_pipeline(r)
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# In dev/single-node mode:  REDIS_URL=redis://redis:6379/0
# In cluster mode:          REDIS_CLUSTER_NODES=redis-1:6379,redis-2:6379,...
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
REDIS_CLUSTER_NODES_RAW = os.getenv("REDIS_CLUSTER_NODES", "")

# Cluster is active only when REDIS_CLUSTER_NODES is set
CLUSTER_MODE = bool(REDIS_CLUSTER_NODES_RAW)

_client = None


# ---------------------------------------------------------------------------
# Connection factory (auto-selects standalone vs cluster)
# ---------------------------------------------------------------------------

def get_redis():
    """
    Returns a Redis client appropriate for the deployment mode.

    - Development / single node: standard redis.Redis via REDIS_URL
    - Production / hyperscale:   redis.cluster.RedisCluster via REDIS_CLUSTER_NODES

    The client is a module-level singleton — safe for Django and Celery.
    """
    global _client
    if _client is not None:
        return _client

    _client = _build_cluster_client() if CLUSTER_MODE else _build_standalone_client()

    return _client


def _build_standalone_client():
    """Single-node Redis (default: dev and staging)."""
    import redis
    client = redis.from_url(REDIS_URL, decode_responses=True)
    logger.info("redis.mode=standalone url=%s", REDIS_URL)
    return client


def _build_cluster_client():
    """
    6-node Redis Cluster client (production hyperscale).

    Parses REDIS_CLUSTER_NODES=host1:port,host2:port,...
    and connects using redis-py's native cluster support
    (redis >= 4.1.0 — already in requirements.txt).
    """
    import redis.cluster
    from redis.cluster import ClusterNode

    nodes = []
    for entry in REDIS_CLUSTER_NODES_RAW.split(","):
        entry = entry.strip()
        if not entry:
            continue
        host, _, port = entry.rpartition(":")
        nodes.append(ClusterNode(host=host, port=int(port or 6379)))

    client = redis.cluster.RedisCluster(
        startup_nodes=nodes,
        decode_responses=True,
        skip_full_coverage_check=True,   # Allows partial coverage in degraded mode
        read_from_replicas=True,         # Route GET operations to replicas (3x read throughput)
    )
    logger.info("redis.mode=cluster nodes=%d", len(nodes))
    return client


def get_pipeline(client=None):
    """
    Returns a Redis pipeline (or cluster pipeline).
    Both support context managers and batch operations.

    Args:
        client: Optional Redis/RedisCluster instance. Defaults to get_redis().
    """
    r = client or get_redis()
    return r.pipeline()


def health_check() -> dict:
    """
    Returns cluster topology status for monitoring endpoints.

    Returns:
        dict with mode, node count, and ping latency in ms.
    """
    import time
    r = get_redis()
    try:
        t0 = time.monotonic()
        r.ping()
        latency_ms = round((time.monotonic() - t0) * 1000, 2)

        if CLUSTER_MODE:
            info = r.cluster_info()
            return {
                "mode": "cluster",
                "status": info.get("cluster_state", "unknown"),
                "slots_assigned": info.get("cluster_slots_assigned", 0),
                "known_nodes": info.get("cluster_known_nodes", 0),
                "latency_ms": latency_ms,
            }
        else:
            return {
                "mode": "standalone",
                "status": "ok",
                "latency_ms": latency_ms,
            }
    except Exception as exc:
        logger.error("redis.health_check_failed err=%s", exc)
        return {"mode": "cluster" if CLUSTER_MODE else "standalone", "status": "error", "error": str(exc)}
