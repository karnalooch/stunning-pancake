"""
Simulator data-plane modes.

- sim_prod_local_writes: prod backend runs sim on local Postgres/Redis (no sim-lab proxy).
- sim_integration_test_mode: sim-lab only — prod-like heuristics on isolated DB.

Toggle via Redis (admin UI) or env bootstrap.
"""

from __future__ import annotations

import os
from typing import Any

from core.redis_cluster import get_redis

REDIS_KEY_INTEGRATION = "{sim}:integration_test_mode"
REDIS_KEY_PROD_LOCAL = "{sim}:prod_local_writes"


def _env_flag(name: str) -> bool:
    return os.getenv(name, "0").lower() in ("1", "true", "yes")


def _redis_flag(key: str) -> bool | None:
    try:
        raw = get_redis().get(key)
    except Exception:
        return None
    if raw is None:
        return None
    val = raw.decode() if isinstance(raw, bytes) else str(raw)
    return val.strip().lower() in ("1", "true", "yes")


def _redis_mode(key: str, *, env_name: str) -> bool:
    cached = _redis_flag(key)
    if cached is not None:
        return cached
    return _env_flag(env_name)


def sim_prod_local_writes() -> bool:
    """When True on prod, simulator mutating ops use this backend's DB (not sim-lab proxy)."""
    from activities.sim_lab_proxy import sim_lab_proxy_enabled, sim_lab_tenant

    if sim_lab_tenant():
        return False
    if not sim_lab_proxy_enabled():
        return True
    return _redis_mode(REDIS_KEY_PROD_LOCAL, env_name="SIM_PROD_LOCAL_WRITES")


def sim_integration_test_mode() -> bool:
    """Sim-lab: prod-like labels/forensics on isolated DB."""
    return _redis_mode(REDIS_KEY_INTEGRATION, env_name="SIM_INTEGRATION_TEST_MODE")


def sim_users_are_synthetic() -> bool:
    return not (sim_integration_test_mode() or sim_prod_local_writes())


def sim_data_plane() -> str:
    return "production" if sim_prod_local_writes() else "sim-lab"


def set_integration_test_mode(enabled: bool) -> None:
    get_redis().set(REDIS_KEY_INTEGRATION, "1" if enabled else "0")


def set_prod_local_writes(enabled: bool) -> None:
    get_redis().set(REDIS_KEY_PROD_LOCAL, "1" if enabled else "0")


def integration_test_mode_info() -> dict[str, Any]:
    env_default = _env_flag("SIM_INTEGRATION_TEST_MODE")
    redis_val = _redis_flag(REDIS_KEY_INTEGRATION)
    enabled = sim_integration_test_mode()
    return {
        "integration_test_mode": enabled,
        "integration_test_env_default": env_default,
        "integration_test_redis_override": redis_val is not None,
    }


def prod_local_writes_info() -> dict[str, Any]:
    from activities.sim_lab_proxy import sim_lab_proxy_enabled, sim_lab_tenant

    env_default = _env_flag("SIM_PROD_LOCAL_WRITES")
    redis_val = _redis_flag(REDIS_KEY_PROD_LOCAL)
    enabled = sim_prod_local_writes()
    editable = not sim_lab_tenant() and sim_lab_proxy_enabled()
    return {
        "prod_local_writes": enabled,
        "sim_data_plane": sim_data_plane(),
        "prod_local_env_default": env_default,
        "prod_local_redis_override": redis_val is not None,
        "prod_local_editable": editable,
    }


def sim_data_plane_info() -> dict[str, Any]:
    return {**integration_test_mode_info(), **prod_local_writes_info()}
