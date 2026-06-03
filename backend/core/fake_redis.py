"""In-memory Redis stand-in for local dev and pytest (no network, no OOM on huge keys)."""

from __future__ import annotations

from typing import Any


class FakeRedis:
    """Minimal redis.Redis API subset used by simulator, wipe, and leaderboard code."""

    def __init__(self) -> None:
        self.storage: dict[str, Any] = {}

    def hgetall(self, key: str) -> dict:
        return dict(self.storage.get(key, {}))

    def hset(
        self,
        key: str,
        field: Any = None,
        value: Any = None,
        mapping: dict | None = None,
        **kwargs: Any,
    ) -> int:
        """Mirrors redis-py: hset(name, key=None, value=None, mapping=None)."""
        if key not in self.storage:
            self.storage[key] = {}
        bucket = self.storage[key]

        def _put(k: Any, v: Any) -> None:
            k_b = k.encode() if isinstance(k, str) else k
            v_b = v.encode() if isinstance(v, str) else v
            bucket[k_b] = v_b

        if field is not None and value is not None:
            _put(field, value)
        if isinstance(mapping, dict):
            for k, v in mapping.items():
                _put(k, v)
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

    # --- Hash multi-get -----------------------------------------------------
    def hmget(self, key: str, fields) -> list:
        bucket = self.storage.get(key, {})
        if isinstance(fields, (str, bytes)):
            fields = [fields]
        out = []
        for f in fields:
            f_b = f.encode() if isinstance(f, str) else f
            val = bucket.get(f_b, bucket.get(f))
            out.append(val)
        return out

    # --- Sorted sets (sliding windows) -------------------------------------
    def _zset(self, key: str) -> dict:
        z = self.storage.get(key)
        if not isinstance(z, dict) or not getattr(z, "_is_zset", False):
            z = _ZDict()
            self.storage[key] = z
        return z

    def zadd(self, key: str, mapping: dict) -> int:
        z = self._zset(key)
        added = 0
        for member, score in mapping.items():
            m_b = member.encode() if isinstance(member, str) else member
            if m_b not in z:
                added += 1
            z[m_b] = float(score)
        return added

    def zremrangebyscore(self, key: str, min_score, max_score) -> int:
        z = self.storage.get(key)
        if not isinstance(z, dict):
            return 0
        lo = float("-inf") if min_score in ("-inf", float("-inf")) else float(min_score)
        hi = float("inf") if max_score in ("+inf", float("inf")) else float(max_score)
        removed = [m for m, s in z.items() if lo <= s <= hi]
        for m in removed:
            del z[m]
        return len(removed)

    def zcard(self, key: str) -> int:
        z = self.storage.get(key)
        return len(z) if isinstance(z, dict) else 0

    def zrem(self, key: str, *members) -> int:
        z = self.storage.get(key)
        if not isinstance(z, dict):
            return 0
        n = 0
        for m in members:
            m_b = m.encode() if isinstance(m, str) else m
            if m_b in z:
                del z[m_b]
                n += 1
            elif m in z:
                del z[m]
                n += 1
        return n

    # --- GEO ----------------------------------------------------------------
    def _geo(self, key: str) -> dict:
        g = self.storage.get(key)
        if not isinstance(g, dict) or not getattr(g, "_is_geo", False):
            g = _GeoDict()
            self.storage[key] = g
        return g

    def geoadd(self, key: str, values) -> int:
        """Accepts a flat sequence lon, lat, member [, lon, lat, member ...]."""
        g = self._geo(key)
        seq = list(values)
        added = 0
        for i in range(0, len(seq) - 2, 3):
            lon, lat, member = float(seq[i]), float(seq[i + 1]), seq[i + 2]
            m_b = member.encode() if isinstance(member, str) else member
            if m_b not in g:
                added += 1
            g[m_b] = (lon, lat)
        return added

    def georadius(self, key, lon, lat, radius, unit="km", count=None, sort=None, **kw):
        g = self.storage.get(key)
        if not isinstance(g, dict):
            return []
        radius_km = float(radius) if unit == "km" else float(radius) / 1000.0
        hits = []
        for member, (mlon, mlat) in g.items():
            d = _haversine_km(lat, lon, mlat, mlon)
            if d <= radius_km:
                hits.append((d, member))
        if sort == "DESC":
            hits.sort(key=lambda x: x[0], reverse=True)
        else:
            hits.sort(key=lambda x: x[0])
        if count is not None:
            hits = hits[: int(count)]
        return [m for _d, m in hits]

    def pipeline(self) -> "FakePipeline":
        return FakePipeline(self)


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    import math

    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return r * 2 * math.asin(min(1.0, math.sqrt(a)))


class _ZDict(dict):
    _is_zset = True


class _GeoDict(dict):
    _is_geo = True


class FakePipeline:
    """Queues commands and replays them on execute(), like redis-py pipelines."""

    def __init__(self, client: "FakeRedis") -> None:
        self._client = client
        self._ops: list[tuple] = []

    def __getattr__(self, name: str):
        def _queue(*args, **kwargs):
            self._ops.append((name, args, kwargs))
            return self

        return _queue

    def execute(self) -> list:
        results = []
        for name, args, kwargs in self._ops:
            method = getattr(self._client, name)
            results.append(method(*args, **kwargs))
        self._ops = []
        return results

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self._ops = []
        return False


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
        "core.load_guard",
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
