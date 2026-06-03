"""In-memory Redis stand-in for local dev and pytest (no network, no OOM on huge keys)."""

from __future__ import annotations

from typing import Any


class FakeRedis:
    """Minimal redis.Redis API subset used by simulator, wipe, and leaderboard code."""

    def __init__(self) -> None:
        self.storage: dict[str, Any] = {}

    def hgetall(self, key: str) -> dict:
        return dict(self.storage.get(key, {}))

    def hset(self, key: str, mapping: dict | None = None, **kwargs: Any) -> int:
        if key not in self.storage:
            self.storage[key] = {}
        bucket = self.storage[key]
        if isinstance(mapping, dict):
            for k, v in mapping.items():
                k_b = k.encode() if isinstance(k, str) else k
                v_b = v.encode() if isinstance(v, str) else v
                bucket[k_b] = v_b
        return len(bucket)

    def hdel(self, key: str, *fields: Any) -> int:
        if key not in self.storage:
            return 0
        bucket = self.storage[key]
        removed = 0
        for f in fields:
            f_b = f.encode() if isinstance(f, str) else f
            if bucket.pop(f_b, None) is not None:
                removed += 1
            elif bucket.pop(f, None) is not None:
                removed += 1
        return removed

    def hlen(self, key: str) -> int:
        return len(self.storage.get(key, {}))

    def hincrby(self, key: str, field: str, amount: int = 1) -> int:
        if key not in self.storage:
            self.storage[key] = {}
        bucket = self.storage[key]
        f_b = field.encode() if isinstance(field, str) else field
        cur = bucket.get(f_b, bucket.get(field, 0))
        if isinstance(cur, bytes):
            cur = int(cur.decode())
        elif isinstance(cur, str):
            cur = int(cur)
        else:
            cur = int(cur or 0)
        new_val = cur + int(amount)
        bucket[f_b] = str(new_val).encode()
        return new_val

    def scard(self, key: str) -> int:
        bucket = self.storage.get(key)
        if isinstance(bucket, set):
            return len(bucket)
        return 0

    def delete(self, *keys: str) -> int:
        n = 0
        for k in keys:
            if self.storage.pop(k, None) is not None:
                n += 1
        return n

    def exists(self, *keys: str) -> int:
        return sum(1 for k in keys if k in self.storage)

    def rpush(self, key: str, value: Any) -> int:
        if key not in self.storage:
            self.storage[key] = []
        lst = self.storage[key]
        lst.append(value.encode() if isinstance(value, str) else value)
        return len(lst)

    def ltrim(self, key: str, start: int, end: int) -> bool:
        if key in self.storage:
            lst = self.storage[key]
            self.storage[key] = lst[start : end + 1 if end != -1 else None]
        return True

    def lrange(self, key: str, start: int, end: int) -> list:
        lst = self.storage.get(key, [])
        return lst[start : end + 1 if end != -1 else None]

    def set(self, key: str, value: Any, nx: bool = False, ex: int | None = None) -> bool:
        if nx and key in self.storage:
            return False
        self.storage[key] = value.encode() if isinstance(value, str) else value
        return True

    def expire(self, key: str, ttl: int) -> bool:
        return True

    def setex(self, key: str, ttl: int, value: Any) -> bool:
        self.storage[key] = value.encode() if isinstance(value, str) else value
        return True

    def get(self, key: str) -> Any:
        val = self.storage.get(key)
        if val is None:
            return None
        return val.decode() if isinstance(val, bytes) else val

    def sadd(self, key: str, *members: Any) -> int:
        if key not in self.storage:
            self.storage[key] = set()
        bucket = self.storage[key]
        for m in members:
            bucket.add(m.encode() if isinstance(m, str) else m)
        return len(bucket)

    def smembers(self, key: str) -> set:
        return set(self.storage.get(key, set()))

    def srem(self, key: str, *members: Any) -> int:
        if key not in self.storage:
            return 0
        bucket = self.storage[key]
        removed = 0
        for m in members:
            m_b = m.encode() if isinstance(m, str) else m
            if m_b in bucket:
                bucket.discard(m_b)
                removed += 1
        return removed

    def srandmember(self, key: str, count: int | None = None) -> Any:
        bucket = self.storage.get(key, set())
        if not bucket:
            return None
        if count is None:
            return next(iter(bucket))
        return list(bucket)[:count]

    def scan_iter(self, match: str | None = None, count: int | None = None):
        prefix = (match or "*").rstrip("*")
        for key in list(self.storage):
            if match is None or key.startswith(prefix):
                yield key


def install_pytest_redis() -> FakeRedis:
    """Replace get_redis everywhere tests import it (avoids stale import bindings)."""
    import sys

    import core.redis_cluster as rc

    instance = FakeRedis()
    rc._client = None

    def _get() -> FakeRedis:
        return instance

    rc.get_redis = _get  # type: ignore[method-assign]

    for mod_name in (
        "activities.simulator_state",
        "activities.wipe_state",
        "activities.admin_stats",
        "activities.views",
        "activities.wearables",
        "activities.leaderboards",
        "activities.leaderboard_credit",
        "activities.heatmap",
        "activities.tasks",
        "activities.scale_preflight",
        "activities.scale_disk_guard",
        "activities.scale_disk_monitor",
        "activities.signals",
        "users.bulk_state",
        "events.burst",
        "events.tasks",
        "core.social_auth",
        "core.matrix_e2ee_verify",
    ):
        mod = sys.modules.get(mod_name)
        if mod is not None and hasattr(mod, "get_redis"):
            mod.get_redis = _get  # type: ignore[method-assign]

    return instance


def decode_hash(raw: dict) -> dict[str, str]:
    """Helper for tests asserting on hgetall payloads."""
    out: dict[str, str] = {}
    for k, v in raw.items():
        key = k.decode() if isinstance(k, bytes) else str(k)
        val = v.decode() if isinstance(v, bytes) else str(v)
        out[key] = val
    return out
