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
            cls._clients = dict.fromkeys(range(n), shared)
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


# ---------------------------------------------------------------------------
# Live map read shedding (ADR 011 P2) — shed reads, not writes, when ingest engaged
# ---------------------------------------------------------------------------


def _live_map_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _live_map_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class LiveMapReadPolicy:
    """When global ingest guard is engaged, reduce live-map Redis/API pressure."""

    ingest_engaged: bool
    cap_multiplier: float
    poll_interval_multiplier: float
    cache_ttl_seconds: int
    detail_ceiling: str | None


def ingest_guard_engaged() -> bool:
    """True when always-on ingest signal is in hysteresis (read-only, no window writes)."""
    try:
        from core.load_guard import guard_snapshot

        snap = guard_snapshot()
        ingest = snap.get("signals", {}).get("ingest", {})
        return bool(ingest.get("engaged"))
    except Exception as exc:
        logger.debug("live_map.ingest_engaged_lookup_failed err=%s", exc)
        return False


def live_map_read_policy() -> LiveMapReadPolicy:
    """
    Policy for TelemetryService.get_live_positions and admin LiveMap polling.

    Env (only applied when ingest engaged):
        LIVE_MAP_INGEST_CAP_RATIO — multiply viewport cap (default 0.35)
        LIVE_MAP_INGEST_POLL_RATIO — client poll slowdown hint (default 2.5)
        LIVE_MAP_INGEST_CACHE_TTL — seconds Redis live cache (default 8)
        LIVE_MAP_INGEST_DETAIL_CEILING — summary|standard|full cap (default standard)
    """
    engaged = ingest_guard_engaged()
    full_scale = os.getenv("LIVE_MAP_FULL_SCALE", "0").lower() in ("1", "true", "yes")
    if not engaged:
        return LiveMapReadPolicy(
            ingest_engaged=False,
            cap_multiplier=1.0,
            poll_interval_multiplier=1.0,
            cache_ttl_seconds=0,
            detail_ceiling=None,
        )
    if full_scale:
        return LiveMapReadPolicy(
            ingest_engaged=True,
            cap_multiplier=1.0,
            poll_interval_multiplier=max(
                1.0, min(3.0, _live_map_float("LIVE_MAP_INGEST_POLL_RATIO", 1.5))
            ),
            cache_ttl_seconds=max(2, _live_map_int("LIVE_MAP_INGEST_CACHE_TTL", 4)),
            detail_ceiling=None,
        )
    ceiling = (os.getenv("LIVE_MAP_INGEST_DETAIL_CEILING", "standard") or "standard").strip().lower()
    if ceiling not in ("summary", "standard", "full"):
        ceiling = "standard"
    cap_mult = max(0.05, min(1.0, _live_map_float("LIVE_MAP_INGEST_CAP_RATIO", 0.35)))
    poll_mult = max(1.0, min(10.0, _live_map_float("LIVE_MAP_INGEST_POLL_RATIO", 2.5)))
    cache_ttl = max(2, _live_map_int("LIVE_MAP_INGEST_CACHE_TTL", 8))
    return LiveMapReadPolicy(
        ingest_engaged=True,
        cap_multiplier=cap_mult,
        poll_interval_multiplier=poll_mult,
        cache_ttl_seconds=cache_ttl,
        detail_ceiling=ceiling,
    )


def apply_live_map_cap(cap: int, policy: LiveMapReadPolicy | None = None) -> int:
    """Reduce GEORADIUS result cap under ingest pressure."""
    pol = policy if policy is not None else live_map_read_policy()
    if not pol.ingest_engaged or cap <= 0:
        return cap
    return max(1, int(cap * pol.cap_multiplier))
