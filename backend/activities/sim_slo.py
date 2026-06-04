"""
Live simulator SLO throttle — reduces start pressure when the routing pipeline is saturated.

Complements routing backpressure (dispatch side) by capping new starts (demand side) when
ride_warming stays high. Does not change active_ratio unless SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP=1.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

logger = logging.getLogger("activities.simulator")

_SLO_LOG_INTERVAL_S = 60.0
_last_slo_log_at = 0.0


def slo_auto_throttle_enabled() -> bool:
    return os.getenv("SIM_SLO_AUTO_THROTTLE", "1").lower() not in ("0", "false", "no", "off")


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def warming_threshold() -> int:
    return max(50, _int_env("SIM_SLO_WARMING_ABOVE", 280))


def warming_after_ticks() -> int:
    return max(1, _int_env("SIM_SLO_AFTER_TICKS", 6))


def starts_cap_when_engaged() -> int:
    return max(10, _int_env("SIM_SLO_STARTS_CAP", 50))


def evaluate_starts_slo(
    *,
    warming_count: int,
    consecutive_warming_ticks: int,
    base_max_starts: int,
    enabled: bool | None = None,
) -> tuple[int, int, bool, int | None]:
    """
    Returns (effective_max_starts, new_consecutive_ticks, engaged, cap_applied).

    When engaged, effective_max_starts = min(base, SIM_SLO_STARTS_CAP).
    """
    enabled = slo_auto_throttle_enabled() if enabled is None else enabled
    base_max_starts = max(0, int(base_max_starts))
    if not enabled or base_max_starts <= 0:
        return base_max_starts, 0, False, None

    thr = warming_threshold()
    if int(warming_count) >= thr:
        consecutive = int(consecutive_warming_ticks) + 1
    else:
        return base_max_starts, 0, False, None

    if consecutive < warming_after_ticks():
        return base_max_starts, consecutive, False, None

    cap = min(base_max_starts, starts_cap_when_engaged())
    return cap, consecutive, True, cap


def maybe_apply_starts_slo(
    state: dict[str, Any],
    fsm: dict[str, int],
    *,
    base_max_starts: int,
) -> int:
    """
    Update Redis slo_* fields; return effective max_starts_per_live_tick for this tick.
    """
    global _last_slo_log_at
    from activities import simulator_state as sim

    try:
        consecutive = int(state.get("slo_warming_consecutive_ticks") or 0)
    except (TypeError, ValueError):
        consecutive = 0

    warming = int(fsm.get("ride_warming") or 0)
    effective, new_consecutive, engaged, cap = evaluate_starts_slo(
        warming_count=warming,
        consecutive_warming_ticks=consecutive,
        base_max_starts=base_max_starts,
    )

    sim.set_live_state(
        slo_warming_consecutive_ticks=new_consecutive,
        slo_throttle_engaged="true" if engaged else "false",
        slo_max_starts_per_tick=cap if cap is not None else "",
    )

    if engaged and effective < base_max_starts:
        now = time.time()
        if now - _last_slo_log_at >= _SLO_LOG_INTERVAL_S:
            _last_slo_log_at = now
            msg = (
                f"SLO throttle: max_starts {base_max_starts} → {effective} "
                f"(warming={warming} ≥ {warming_threshold()} for {warming_after_ticks()} ticks)"
            )
            logger.info(
                "sim.slo.throttle",
                extra={
                    "warming": warming,
                    "base_max_starts": base_max_starts,
                    "effective_max_starts": effective,
                    "cap": cap,
                },
            )
            sim.live_log(msg)
    return effective
