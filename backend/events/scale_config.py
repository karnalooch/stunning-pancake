"""
Event-day burst limits (~50k coordinated app opens).

Burst protection is automatic by default (EVENT_BURST_MODE=auto).
Override via environment. See docs/EVENT_BURST_50K.md.
"""

from __future__ import annotations

import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.lower() in ("1", "true", "yes", "on")


def _burst_mode() -> str:
    """force_on / force_off / auto (default). Legacy: 1=on, 0=off."""
    val = os.getenv("EVENT_BURST_MODE", "auto")
    if val is None:
        return "auto"
    normalized = str(val).strip().lower()
    if normalized in ("1", "true", "yes", "on", "force_on"):
        return "on"
    if normalized in ("0", "false", "no", "off", "force_off"):
        return "off"
    if normalized == "auto":
        return "auto"
    return "auto"


# Master switch: 'auto' (default), 'on' (always rate-limit), 'off' (dev disable)
EVENT_BURST_MODE = _burst_mode()

# Auto-enable when participation count reaches this (small events stay unlimited)
EVENT_BURST_AUTO_MIN_PARTICIPANTS = _int("EVENT_BURST_AUTO_MIN_PARTICIPANTS", 1000)

# PUBLISHED events enter burst window this many hours before start_date
EVENT_BURST_PUBLISHED_HOURS_BEFORE_START = _int("EVENT_BURST_PUBLISHED_HOURS_BEFORE_START", 24)

# Load spike → set Redis burst:auto (TTL below)
EVENT_BURST_LOAD_JOIN_THRESHOLD = _int("EVENT_BURST_LOAD_JOIN_THRESHOLD", 500)
EVENT_BURST_LOAD_SESSION_THRESHOLD = _int("EVENT_BURST_LOAD_SESSION_THRESHOLD", 300)
EVENT_BURST_LOAD_SPIKE_JOIN_THRESHOLD = _int("EVENT_BURST_LOAD_SPIKE_JOIN_THRESHOLD", 200)

# How long load-driven auto burst stays on
EVENT_BURST_AUTO_TTL_SECONDS = _int("EVENT_BURST_AUTO_TTL_SECONDS", 7200)

# Concurrent riders on map during events (live sim publish + live-map index target)
EVENT_MAX_CONCURRENT_RIDERS = _int("EVENT_MAX_CONCURRENT_RIDERS", 50_000)

# Spread synthetic live-sim ride starts across this window (seconds)
EVENT_START_STAGGER_SECONDS = _int("EVENT_START_STAGGER_SECONDS", 600)

# Soft caps per event (sliding 60s windows in Redis)
EVENT_JOIN_RATE_PER_MINUTE = _int("EVENT_JOIN_RATE_PER_MINUTE", 5_000)
EVENT_SESSION_START_RATE_PER_MINUTE = _int("EVENT_SESSION_START_RATE_PER_MINUTE", 3_000)

# Admin live sim: use EVENT_MAX_CONCURRENT_RIDERS instead of SCALE_MAX_CONCURRENT_RIDERS
SCALE_EVENT_LOAD_TEST = _bool("SCALE_EVENT_LOAD_TEST", False)
EVENT_TARGET_POOL_USERS = _int("EVENT_TARGET_POOL_USERS", 50_000)
