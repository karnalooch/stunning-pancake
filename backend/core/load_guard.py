"""
Global, always-on platform protection (decoupled from any event).

Unlike `events.burst` (event-scoped: limits engage only for large/active events),
this guard watches **platform-wide** live load signals — join rate, session-start
rate, telemetry ingest rate — and applies hard caps automatically, whether or not
an event exists.

Design goals (enterprise):
- Safe defaults: `GLOBAL_PROTECTION_MODE=auto` with high caps means **no behaviour
  change under normal load**. Limits only bite once a signal crosses its cap.
- Hysteresis: once engaged for a signal, protection stays "engaged" for a short
  TTL so we don't flap on/off around the threshold (mirrors `events.burst:auto`).
- Fail-open: any Redis error returns "allowed" — protection must never take the
  platform down. Mirrors `events.burst.sliding_window_try`.
- Pure decision core (`evaluate_signal`) is unit-testable without Redis, exactly
  like `activities.simulator_routing_backpressure`.

Layering:
    request → global guard (this module, always-on) → event burst (event-scoped)
The two layers are independent; the global layer is the floor everyone hits.

Structured logs use the `core.load_guard` logger and `loadguard.*` event names,
matching the `sim.routing.*` style.
"""

from __future__ import annotations

import math
import os
import time
import uuid
from dataclasses import dataclass

from core.redis_cluster import get_redis

import logging

logger = logging.getLogger("core.load_guard")

# Signals the guard tracks. Join/session are per-minute; ingest is per-second.
SIGNAL_JOIN = "join"
SIGNAL_SESSION = "session"
SIGNAL_INGEST = "ingest"

_WINDOW_SECONDS = {
    SIGNAL_JOIN: 60,
    SIGNAL_SESSION: 60,
    SIGNAL_INGEST: 1,
}

_GLOBAL_TAG = "{global}"  # Redis Cluster hash tag — all guard keys share one slot
_TRACK_LIMIT = 999_999_999  # always record into the window (load detection)
_ENGAGED_TTL_S = 120  # hysteresis: stay engaged this long after last trip


# ---------------------------------------------------------------------------
# Configuration (env, safe high defaults)
# ---------------------------------------------------------------------------


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def global_protection_mode() -> str:
    """auto (default) | on (always enforce) | off (disabled)."""
    val = (os.getenv("GLOBAL_PROTECTION_MODE", "auto") or "auto").strip().lower()
    if val in ("1", "true", "yes", "on", "force_on"):
        return "on"
    if val in ("0", "false", "no", "off", "force_off"):
        return "off"
    return "auto"


def signal_limit(signal: str) -> int:
    """Hard cap for a signal (per its window). 0/negative disables that signal."""
    if signal == SIGNAL_JOIN:
        return _int("GLOBAL_MAX_JOIN_PER_MINUTE", 8_000)
    if signal == SIGNAL_SESSION:
        return _int("GLOBAL_MAX_SESSION_PER_MINUTE", 5_000)
    if signal == SIGNAL_INGEST:
        return _int("GLOBAL_MAX_INGEST_PER_SECOND", 20_000)
    return 0


def engage_ratio() -> float:
    """In auto mode, protection engages once count >= ratio * limit."""
    return max(0.1, min(1.0, _float("GLOBAL_PROTECTION_ENGAGE_RATIO", 0.9)))


def global_concurrent_cap_value() -> int:
    """Platform-wide concurrent-rider ceiling (always-on)."""
    return _int("GLOBAL_MAX_CONCURRENT_RIDERS", 50_000)


# ---------------------------------------------------------------------------
# Redis keys
# ---------------------------------------------------------------------------


def guard_keys() -> dict[str, str]:
    return {
        SIGNAL_JOIN: f"{_GLOBAL_TAG}:loadguard:join:sw",
        SIGNAL_SESSION: f"{_GLOBAL_TAG}:loadguard:session:sw",
        SIGNAL_INGEST: f"{_GLOBAL_TAG}:loadguard:ingest:sw",
        "engaged_join": f"{_GLOBAL_TAG}:loadguard:engaged:join",
        "engaged_session": f"{_GLOBAL_TAG}:loadguard:engaged:session",
        "engaged_ingest": f"{_GLOBAL_TAG}:loadguard:engaged:ingest",
    }


def _engaged_key(signal: str) -> str:
    return guard_keys()[f"engaged_{signal}"]


# ---------------------------------------------------------------------------
# Pure decision core (unit-testable, no Redis)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class GuardDecision:
    allowed: bool
    signal: str
    count: int
    limit: int
    mode: str
    engaged: bool
    retry_after: int

    def as_meta(self) -> dict:
        return {
            "signal": self.signal,
            "allowed": self.allowed,
            "count": self.count,
            "limit": self.limit,
            "mode": self.mode,
            "engaged": self.engaged,
            "retry_after": self.retry_after,
        }


def _retry_after_for(signal: str) -> int:
    window = _WINDOW_SECONDS.get(signal, 60)
    if window <= 1:
        return 1
    return max(1, int(math.ceil(window - (time.time() % window))))


def evaluate_signal(
    signal: str,
    count: int,
    *,
    mode: str,
    limit: int,
    was_engaged: bool,
    engage_ratio_val: float = 0.9,
) -> GuardDecision:
    """
    Decide whether a request is allowed, given the current sliding-window count.

    - mode 'off'              → always allowed, never engaged.
    - mode 'on'               → engaged whenever count > limit (hard enforce).
    - mode 'auto'             → engages once count >= engage_ratio*limit (or it was
                                already engaged via hysteresis); rejects when count
                                exceeds limit while engaged.
    - limit <= 0              → signal disabled, always allowed.
    """
    if mode == "off" or limit <= 0:
        return GuardDecision(True, signal, count, limit, mode, False, 0)

    if mode == "on":
        engaged_now = count > limit or was_engaged
        if count > limit:
            return GuardDecision(
                False, signal, count, limit, mode, True, _retry_after_for(signal)
            )
        return GuardDecision(True, signal, count, limit, mode, engaged_now, 0)

    # auto
    trip_at = int(engage_ratio_val * limit)
    engaged_now = was_engaged or count >= trip_at
    if engaged_now and count > limit:
        return GuardDecision(
            False, signal, count, limit, mode, True, _retry_after_for(signal)
        )
    return GuardDecision(True, signal, count, limit, mode, engaged_now, 0)


# ---------------------------------------------------------------------------
# Redis-backed sliding window (fail-open)
# ---------------------------------------------------------------------------


def _record_and_count(redis_key: str, window_seconds: int) -> int:
    """Add one event to the sliding window and return the current window count."""
    now = time.time()
    member = f"{now}:{uuid.uuid4().hex[:8]}"
    try:
        r = get_redis()
        pipe = r.pipeline()
        pipe.zremrangebyscore(redis_key, 0, now - window_seconds)
        pipe.zadd(redis_key, {member: now})
        pipe.zcard(redis_key)
        pipe.expire(redis_key, window_seconds + 10)
        _, _, count, _ = pipe.execute()
        return int(count or 0)
    except Exception as exc:  # fail-open
        logger.debug("loadguard.window_failed key=%s err=%s", redis_key, exc)
        return 0


def window_count(redis_key: str, window_seconds: int) -> int:
    """Current window count without incrementing (read-only snapshot)."""
    now = time.time()
    try:
        r = get_redis()
        r.zremrangebyscore(redis_key, 0, now - window_seconds)
        return int(r.zcard(redis_key) or 0)
    except Exception:
        return 0


def _is_engaged(signal: str) -> bool:
    try:
        return bool(get_redis().get(_engaged_key(signal)))
    except Exception:
        return False


def _set_engaged(signal: str) -> None:
    try:
        get_redis().set(_engaged_key(signal), "1", ex=_ENGAGED_TTL_S)
    except Exception as exc:
        logger.debug("loadguard.engage_flag_failed signal=%s err=%s", signal, exc)


# ---------------------------------------------------------------------------
# Public API — one call per protected request
# ---------------------------------------------------------------------------


def check_signal(signal: str) -> GuardDecision:
    """
    Record one occurrence of `signal` and decide if the request is allowed.

    Always-on: this does not depend on any event existing. Under normal load
    (count below cap) it returns allowed and is effectively a no-op besides the
    cheap sliding-window write.
    """
    mode = global_protection_mode()
    limit = signal_limit(signal)
    if mode == "off" or limit <= 0:
        # Skip Redis writes entirely when disabled.
        return GuardDecision(True, signal, 0, limit, mode, False, 0)

    window = _WINDOW_SECONDS.get(signal, 60)
    keys = guard_keys()
    count = _record_and_count(keys[signal], window)
    was_engaged = _is_engaged(signal)

    decision = evaluate_signal(
        signal,
        count,
        mode=mode,
        limit=limit,
        was_engaged=was_engaged,
        engage_ratio_val=engage_ratio(),
    )

    if decision.engaged and not was_engaged:
        _set_engaged(signal)
        logger.info(
            "loadguard.engaged",
            extra={"signal": signal, "count": count, "limit": limit, "mode": mode},
        )
    if not decision.allowed:
        logger.warning(
            "loadguard.throttled",
            extra={
                "signal": signal,
                "count": count,
                "limit": limit,
                "retry_after": decision.retry_after,
            },
        )
    return decision


def check_join() -> GuardDecision:
    return check_signal(SIGNAL_JOIN)


def check_session_start() -> GuardDecision:
    return check_signal(SIGNAL_SESSION)


def check_ingest(n: int = 1) -> GuardDecision:
    """
    Telemetry ingest guard. `n` lets a batch count as multiple packets so a
    single huge batch can't slip under a per-request cap.
    """
    mode = global_protection_mode()
    limit = signal_limit(SIGNAL_INGEST)
    if mode == "off" or limit <= 0:
        return GuardDecision(True, SIGNAL_INGEST, 0, limit, mode, False, 0)

    window = _WINDOW_SECONDS[SIGNAL_INGEST]
    keys = guard_keys()
    count = 0
    for _ in range(max(1, int(n))):
        count = _record_and_count(keys[SIGNAL_INGEST], window)
    was_engaged = _is_engaged(SIGNAL_INGEST)
    decision = evaluate_signal(
        SIGNAL_INGEST,
        count,
        mode=mode,
        limit=limit,
        was_engaged=was_engaged,
        engage_ratio_val=engage_ratio(),
    )
    if decision.engaged and not was_engaged:
        _set_engaged(SIGNAL_INGEST)
        logger.info(
            "loadguard.engaged",
            extra={"signal": SIGNAL_INGEST, "count": count, "limit": limit},
        )
    if not decision.allowed:
        logger.warning(
            "loadguard.throttled",
            extra={"signal": SIGNAL_INGEST, "count": count, "limit": limit},
        )
    return decision


def global_concurrent_cap(live_state: dict | None = None) -> int:
    """
    Effective concurrent-rider cap — the lower of the event-scoped cap (when an
    event/load test is running) and the platform-wide always-on ceiling.
    """
    platform_cap = global_concurrent_cap_value()
    if global_protection_mode() == "off":
        # Fall back to event/sim cap only.
        from events.burst import effective_event_concurrent_cap

        return effective_event_concurrent_cap(live_state)
    from events.burst import effective_event_concurrent_cap

    event_cap = effective_event_concurrent_cap(live_state)
    return min(platform_cap, event_cap) if event_cap > 0 else platform_cap


def guard_snapshot() -> dict:
    """Read-only status for admin/monitoring endpoints (no window writes)."""
    mode = global_protection_mode()
    keys = guard_keys()
    out: dict = {"mode": mode, "signals": {}}
    for signal in (SIGNAL_JOIN, SIGNAL_SESSION, SIGNAL_INGEST):
        limit = signal_limit(signal)
        window = _WINDOW_SECONDS[signal]
        count = window_count(keys[signal], window) if mode != "off" else 0
        out["signals"][signal] = {
            "count": count,
            "limit": limit,
            "window_seconds": window,
            "engaged": _is_engaged(signal) if mode != "off" else False,
        }
    out["concurrent_cap"] = global_concurrent_cap_value()
    return out
