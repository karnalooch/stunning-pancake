"""
Integration test mode — treat simulator users/activities like production data.

Enabled on sim-lab (or local dev) to exercise leaderboards, GPX export, anti-cheat,
retention, and federated admin KPIs without synthetic flags or auto-cleanup heuristics.

Toggle via Redis (admin UI) or bootstrap with SIM_INTEGRATION_TEST_MODE=1.
"""

from __future__ import annotations

import os
from typing import Any

from core.redis_cluster import get_redis

REDIS_KEY = "{sim}:integration_test_mode"


def _env_default_enabled() -> bool:
    return os.getenv("SIM_INTEGRATION_TEST_MODE", "0").lower() in ("1", "true", "yes")


def _redis_enabled() -> bool | None:
    try:
        raw = get_redis().get(REDIS_KEY)
    except Exception:
        return None
    if raw is None:
        return None
    val = raw.decode() if isinstance(raw, bytes) else str(raw)
    return val.strip().lower() in ("1", "true", "yes")


def sim_integration_test_mode() -> bool:
    """When True, simulated users flow through prod-like code paths on sim-lab."""
    cached = _redis_enabled()
    if cached is not None:
        return cached
    return _env_default_enabled()


def sim_users_are_synthetic() -> bool:
    return not sim_integration_test_mode()


def set_integration_test_mode(enabled: bool) -> None:
    get_redis().set(REDIS_KEY, "1" if enabled else "0")


def integration_test_mode_info() -> dict[str, Any]:
    env_default = _env_default_enabled()
    redis_val = _redis_enabled()
    enabled = sim_integration_test_mode()
    return {
        "integration_test_mode": enabled,
        "integration_test_env_default": env_default,
        "integration_test_redis_override": redis_val is not None,
    }
