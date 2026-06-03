"""
Telemetry shard router — horizontal sharding of the live-position index.

Today `TelemetryService` keeps every active rider in two single Redis keys:
`telemetry:positions` (hash) and `telemetry:geo` (GEO index). At true 50k+
simultaneous ingest that single hash / GEO set is the ceiling (one shard owns
the slot, GEORADIUS scans one big index).

This module introduces a deterministic shard router so the index can be spread
across N logical shards by `deviceId`. Each shard gets its own pair of keys with
a Redis-Cluster hash tag `{tel:<i>}`, so all keys of a shard live on the same
cluster slot/node and pipelines stay single-slot.

Backward compatibility (critical):
    TELEMETRY_SHARD_COUNT=1 (default) → keys are EXACTLY the legacy names
    (`telemetry:positions`, `telemetry:geo`). No data migration, no behaviour
    change. Sharding only activates when the operator sets the count > 1.

Phase 2 — per-shard Redis routing:
    REDIS_TELEMETRY_SHARD_NODES=url0,url1,... maps each shard index to a
    dedicated Redis URL (separate instances or logical DBs on one host, e.g.
    redis://host:6379/0 … /3). When unset, all shards use `get_redis()` — still
    valid on Redis Cluster via hash tags.

Read strategy:
    - Writes go to exactly one shard (the device's shard).
    - Reads fan out across all shards in parallel and merge (cap-limited).

The router itself is pure (no Redis) for key selection; `TelemetryShardRouter`
handles client routing.
"""

from __future__ import annotations

import logging
import os
import re
import zlib
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

_LEGACY_PREFIX = "telemetry:"


def shard_count() -> int:
    """Number of telemetry shards. 1 (default) = legacy single-key behaviour."""
    try:
        n = int(os.getenv("TELEMETRY_SHARD_COUNT", "1"))
    except (TypeError, ValueError):
        return 1
    return max(1, min(n, 256))  # hard cap — never explode key fan-out


def shard_for_device(device_id: str, count: int | None = None) -> int:
    """
    Deterministic shard index for a device id.

    Uses CRC32 (stable across processes/Python versions, unlike hash()), so the
    same device always lands on the same shard for the configured count.
    """
    n = count if count is not None else shard_count()
    if n <= 1:
        return 0
    digest = zlib.crc32(str(device_id).encode("utf-8")) & 0xFFFFFFFF
    return digest % n


@dataclass(frozen=True)
class ShardKeys:
    index: int
    positions: str
    geo: str


def shard_keys(index: int, count: int | None = None) -> ShardKeys:
    """
    Redis keys for a shard.

    Shard 0 with count==1 returns the LEGACY key names for backward compatibility.
    Any sharded layout uses a `{tel:<i>}` hash tag so the pair shares a slot.
    """
    n = count if count is not None else shard_count()
    if n <= 1:
        return ShardKeys(
            index=0,
            positions=f"{_LEGACY_PREFIX}positions",
            geo=f"{_LEGACY_PREFIX}geo",
        )
    tag = f"{{tel:{index}}}"
    return ShardKeys(
        index=index,
        positions=f"{tag}:telemetry:positions",
        geo=f"{tag}:telemetry:geo",
    )


def keys_for_device(device_id: str, count: int | None = None) -> ShardKeys:
    n = count if count is not None else shard_count()
    return shard_keys(shard_for_device(device_id, n), n)


def all_shard_keys(count: int | None = None) -> list[ShardKeys]:
    """All shard key pairs — used by fan-out reads and bulk clears."""
    n = count if count is not None else shard_count()
    return [shard_keys(i, n) for i in range(n)]


def group_devices_by_shard(
    device_ids,
    count: int | None = None,
) -> dict[int, list[str]]:
    """Bucket a list of device ids by their shard index (for batched writes)."""
    n = count if count is not None else shard_count()
    buckets: dict[int, list[str]] = {}
    for did in device_ids:
        idx = shard_for_device(did, n)
        buckets.setdefault(idx, []).append(did)
    return buckets


def is_sharding_enabled() -> bool:
    return shard_count() > 1


def shard_node_urls_raw() -> str:
    return (os.getenv("REDIS_TELEMETRY_SHARD_NODES", "") or "").strip()


def shard_node_urls() -> list[str]:
    """Parse REDIS_TELEMETRY_SHARD_NODES (comma-separated Redis URLs)."""
    raw = shard_node_urls_raw()
    if not raw:
        return []
    return [u.strip() for u in raw.split(",") if u.strip()]


def has_dedicated_shard_nodes() -> bool:
    return bool(shard_node_urls())


def parallel_shard_workers(count: int | None = None) -> int:
    """Thread-pool size for parallel shard reads."""
    n = count if count is not None else shard_count()
    try:
        cap = int(os.getenv("TELEMETRY_SHARD_READ_WORKERS", "0"))
    except (TypeError, ValueError):
        cap = 0
    if cap > 0:
        return max(1, min(cap, n, 32))
    return max(1, min(n, 8))


def _sanitize_url(url: str) -> str:
    return re.sub(r":([^@]+)@", ":****@", url)


def _build_standalone_client(url: str):
    """Build a standalone redis.Redis client from a URL (mirrors redis_cluster)."""
    import redis
    import urllib.parse

    redis_password = os.getenv("REDIS_PASSWORD", "")
    if redis_password and "://" in url and "@" not in url.split("://", 1)[1]:
        parsed = urllib.parse.urlparse(url)
        encoded_pw = urllib.parse.quote(redis_password, safe="")
        url = parsed._replace(
            netloc=f":{encoded_pw}@{parsed.hostname}:{parsed.port or 6379}"
        ).geturl()

    client = redis.from_url(url, decode_responses=True)
    client.ping()
    logger.info("telemetry_shard.client url=%s", _sanitize_url(url))
    return client


def _resolve_node_urls(n: int) -> list[str]:
    """
    Map shard indices 0..n-1 to Redis URLs.

    When fewer URLs than shards are configured, cycle through the list so
    Phase 2a logical DBs (e.g. four URLs on one host) still work.
    """
    nodes = shard_node_urls()
    if not nodes:
        return []
    if len(nodes) >= n:
        return nodes[:n]
    return [nodes[i % len(nodes)] for i in range(n)]


class TelemetryShardRouter:
    """
    Routes telemetry Redis operations to per-shard clients.

    - TELEMETRY_SHARD_COUNT=1, no REDIS_TELEMETRY_SHARD_NODES → `get_redis()`.
    - TELEMETRY_SHARD_COUNT>1, no shard nodes → single `get_redis()` (Cluster hash tags).
    - REDIS_TELEMETRY_SHARD_NODES set → one client per shard index.
    """

    _clients: dict[int, Any] | None = None

    @classmethod
    def reset(cls) -> None:
        """Drop cached clients (tests and config reload)."""
        cls._clients = None

    @classmethod
    def uses_dedicated_nodes(cls) -> bool:
        return has_dedicated_shard_nodes()

    @classmethod
    def _ensure_clients(cls) -> dict[int, Any]:
        if cls._clients is not None:
            return cls._clients

        n = shard_count()
        node_urls = _resolve_node_urls(n)

        if not node_urls:
            from core.redis_cluster import get_redis

            shared = get_redis()
            cls._clients = {i: shared for i in range(n)}
            return cls._clients

        clients: dict[int, Any] = {}
        for i, url in enumerate(node_urls):
            try:
                clients[i] = _build_standalone_client(url)
            except Exception as exc:
                logger.error(
                    "telemetry_shard.client_failed index=%d url=%s err=%s",
                    i,
                    _sanitize_url(url),
                    exc,
                )
                raise
        cls._clients = clients
        logger.info(
            "telemetry_shard.mode=dedicated nodes=%d shards=%d",
            len(node_urls),
            n,
        )
        return cls._clients

    @classmethod
    def client_for(cls, shard_index: int):
        """Redis client for a shard index (0-based)."""
        n = shard_count()
        idx = int(shard_index) % n
        return cls._ensure_clients()[idx]

    @classmethod
    def all_clients(cls) -> list[Any]:
        """One client per shard index (may repeat the same instance)."""
        n = shard_count()
        clients = cls._ensure_clients()
        return [clients[i] for i in range(n)]
