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

Read strategy:
    - Writes go to exactly one shard (the device's shard).
    - Reads fan out across all shards and merge (cap-limited). City/bbox reads
      still call GEORADIUS per shard with the same radius; results are merged
      and de-duplicated by deviceId.

The router itself is pure (no Redis), so shard selection and key naming are
fully unit-testable.
"""

from __future__ import annotations

import os
import zlib
from dataclasses import dataclass

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
