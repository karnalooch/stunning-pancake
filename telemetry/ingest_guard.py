"""
Async ingest guard for the telemetry service — mirrors backend/core/load_guard.py.

Counts `n` packets per request (not one slot per HTTP request). Fail-open on Redis errors.
"""

from __future__ import annotations

import os
import time
import uuid
from dataclasses import dataclass

_INGEST_GUARD_KEY = "{global}:loadguard:ingest:sw"
_ENGAGED_KEY = "{global}:loadguard:engaged:ingest"


def _global_protection_mode() -> str:
    val = (os.getenv("GLOBAL_PROTECTION_MODE", "auto") or "auto").strip().lower()
    if val in ("1", "true", "yes", "on", "force_on"):
        return "on"
    if val in ("0", "false", "no", "off", "force_off"):
        return "off"
    return "auto"


def _ingest_max_per_second() -> int:
    try:
        return int(os.getenv("GLOBAL_MAX_INGEST_PER_SECOND", "20000"))
    except (TypeError, ValueError):
        return 20_000


def _engage_ratio() -> float:
    try:
        return max(0.1, min(1.0, float(os.getenv("GLOBAL_PROTECTION_ENGAGE_RATIO", "0.9"))))
    except (TypeError, ValueError):
        return 0.9


def _retry_after_seconds() -> int:
    return 1


@dataclass(frozen=True)
class IngestGuardResult:
    allowed: bool
    count: int
    limit: int
    retry_after: int
    engaged: bool
    mode: str

    @property
    def should_queue_active_sessions(self) -> bool:
        """Under auto/on, engaged ingest prefers Redis Stream for active rides."""
        return self.engaged and self.mode != "off"


def evaluate_ingest(
    count: int,
    *,
    mode: str,
    limit: int,
    was_engaged: bool,
    engage_ratio_val: float = 0.9,
) -> IngestGuardResult:
    """Pure decision — same semantics as load_guard.evaluate_signal for ingest."""
    if mode == "off" or limit <= 0:
        return IngestGuardResult(True, count, limit, 0, False, mode)

    if mode == "on":
        engaged_now = count > limit or was_engaged
        if count > limit:
            return IngestGuardResult(False, count, limit, _retry_after_seconds(), True, mode)
        return IngestGuardResult(True, count, limit, 0, engaged_now, mode)

    trip_at = int(engage_ratio_val * limit)
    engaged_now = was_engaged or count >= trip_at
    if engaged_now and count > limit:
        return IngestGuardResult(False, count, limit, _retry_after_seconds(), True, mode)
    return IngestGuardResult(True, count, limit, 0, engaged_now, mode)


async def check_ingest_allowed(redis_client, n: int = 1) -> IngestGuardResult:
    """
    Record `n` ingest events in the 1s sliding window and return guard decision.
    Fail-open when Redis is unavailable.
    """
    mode = _global_protection_mode()
    limit = _ingest_max_per_second()
    if mode == "off" or limit <= 0:
        return IngestGuardResult(True, 0, limit, 0, False, mode)

    now = time.time()
    count = 0
    try:
        for _ in range(max(1, int(n))):
            member = f"{now}:{uuid.uuid4().hex[:8]}"
            pipe = redis_client.pipeline()
            pipe.zremrangebyscore(_INGEST_GUARD_KEY, 0, now - 1.0)
            pipe.zadd(_INGEST_GUARD_KEY, {member: now})
            pipe.zcard(_INGEST_GUARD_KEY)
            pipe.expire(_INGEST_GUARD_KEY, 5)
            results = await pipe.execute()
            count = int(results[-2] or 0)
        was_engaged = bool(await redis_client.get(_ENGAGED_KEY))
    except Exception:
        return IngestGuardResult(True, 0, limit, 0, False, mode)

    decision = evaluate_ingest(
        count,
        mode=mode,
        limit=limit,
        was_engaged=was_engaged,
        engage_ratio_val=_engage_ratio(),
    )

    if decision.engaged and not was_engaged:
        try:
            await redis_client.set(_ENGAGED_KEY, "1", ex=120)
        except Exception:
            pass

    return decision
