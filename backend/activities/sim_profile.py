"""
Live simulator profile: map admin sliders (intensity / load 0–100) to runtime knobs.

SSOT for formulas shared with admin simProfileMap.ts and scripts/sim-handoff-prep.ps1.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

logger = logging.getLogger("activities.simulator")

_PROFILE_LOG_INTERVAL_S = 60.0
_last_profile_auto_lower_log_at = 0.0


def _clamp_int(value: Any, default: int = 50) -> int:
    try:
        v = int(value)
    except (TypeError, ValueError):
        v = default
    return max(0, min(100, v))


def piecewise_lerp(points: list[tuple[int, float]], x: int) -> float:
    """Linear interpolation on (x, y) knots; x clamped to 0–100."""
    x = max(0, min(100, int(x)))
    if not points:
        return 0.0
    if x <= points[0][0]:
        return float(points[0][1])
    for i in range(len(points) - 1):
        x0, y0 = points[i]
        x1, y1 = points[i + 1]
        if x <= x1:
            if x1 == x0:
                return float(y1)
            t = (x - x0) / (x1 - x0)
            return float(y0) + t * (float(y1) - float(y0))
    return float(points[-1][1])


def map_intensity(intensity: int) -> dict[str, float]:
    """Aktywność puli → active_ratio + cheat_ratio."""
    i = _clamp_int(intensity)
    active_ratio = 0.08 + 0.42 * (i / 100.0)
    active_ratio = max(0.08, min(0.50, active_ratio))
    cheat_ratio = max(0.0, min(0.25, 0.12 * (i / 100.0)))
    return {"active_ratio": active_ratio, "cheat_ratio": cheat_ratio}


def map_load(load: int) -> dict[str, int]:
    """Obciążenie systemu → tick + scale_overrides."""
    load_pct = _clamp_int(load)
    # Steeper mid curve: 8× routing workers + inline ticks can sustain much higher dispatch.
    starts = int(round(piecewise_lerp([(0, 50), (50, 200), (75, 400), (100, 1000)], load_pct)))
    brouter = int(round(starts * 0.83))
    attempts = 4 if load_pct < 75 else 5
    tick_seconds = int(round(piecewise_lerp([(0, 10), (50, 6), (75, 5), (100, 4)], load_pct)))
    return {
        "tick_seconds": tick_seconds,
        "max_starts_per_live_tick": starts,
        "brouter_max_calls_per_tick": brouter,
        "brouter_route_attempts": attempts,
    }


def resolve_sim_profile(intensity: int, load: int) -> dict[str, Any]:
    """
    Full profile from two sliders (0–100).

    Returns active_ratio, cheat_ratio, tick_seconds, scale_overrides, and echo intensity/load.
    """
    i = _clamp_int(intensity)
    load_pct = _clamp_int(load)
    intensity_part = map_intensity(i)
    load_part = map_load(load_pct)
    return {
        "intensity": i,
        "load": load_pct,
        "active_ratio": intensity_part["active_ratio"],
        "cheat_ratio": intensity_part["cheat_ratio"],
        "tick_seconds": load_part["tick_seconds"],
        "scale_overrides": {
            "max_starts_per_live_tick": load_part["max_starts_per_live_tick"],
            "brouter_max_calls_per_tick": load_part["brouter_max_calls_per_tick"],
            "brouter_route_attempts": load_part["brouter_route_attempts"],
        },
    }


def parse_intensity_load_from_request(data: dict) -> tuple[dict[str, Any] | None, str | None]:
    """
    If either intensity or load is present, both must be valid 0–100 integers.
    Returns (resolve_sim_profile dict, error_message).
    """
    has_i = "intensity" in data
    has_l = "load" in data
    if not has_i and not has_l:
        return None, None
    if has_i != has_l:
        return None, "intensity and load must be sent together (0–100)"
    try:
        i = int(data["intensity"])
        load_pct = int(data["load"])
    except (TypeError, ValueError):
        return None, "intensity and load must be integers 0–100"
    if i < 0 or i > 100 or load_pct < 0 or load_pct > 100:
        return None, "intensity and load must be 0–100"
    return resolve_sim_profile(i, load_pct), None


def auto_lower_active_ratio_enabled() -> bool:
    return os.getenv("SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP", "0").lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def backpressure_lower_after_ticks() -> int:
    try:
        return max(1, int(os.getenv("SIM_BP_LOWER_AFTER_TICKS", "12")))
    except (TypeError, ValueError):
        return 12


def backpressure_lower_factor() -> float:
    try:
        return max(0.5, min(1.0, float(os.getenv("SIM_BP_LOWER_FACTOR", "0.95"))))
    except (TypeError, ValueError):
        return 0.95


def backpressure_lower_max_ratio() -> float:
    """Do not auto-lower below this ceiling on each step (only applies when lowering)."""
    try:
        return max(0.08, min(0.50, float(os.getenv("SIM_BP_LOWER_MAX_RATIO", "0.30"))))
    except (TypeError, ValueError):
        return 0.30


def evaluate_backpressure_active_ratio_lower(
    *,
    backpressure_active: bool,
    consecutive_bp_ticks: int,
    current_active_ratio: float,
    enabled: bool | None = None,
    after_ticks: int | None = None,
) -> tuple[float, int, bool]:
    """
    Track consecutive backpressure ticks; lower active_ratio when threshold reached.

    new_ratio = current * SIM_BP_LOWER_FACTOR (default 0.95), floored at 0.08.
    Returns (new_ratio, updated_consecutive_ticks, did_lower).
    """
    enabled = auto_lower_active_ratio_enabled() if enabled is None else enabled
    after_ticks = (
        backpressure_lower_after_ticks() if after_ticks is None else max(1, int(after_ticks))
    )

    if not enabled:
        return current_active_ratio, 0 if not backpressure_active else consecutive_bp_ticks, False

    if not backpressure_active:
        return current_active_ratio, 0, False

    consecutive = int(consecutive_bp_ticks) + 1
    if consecutive < after_ticks:
        return current_active_ratio, consecutive, False

    factor = backpressure_lower_factor()
    ceiling = backpressure_lower_max_ratio()
    lowered = min(float(current_active_ratio) * factor, ceiling)
    lowered = max(0.08, lowered)
    if lowered >= float(current_active_ratio):
        return current_active_ratio, 0, False
    return lowered, 0, True


def maybe_auto_lower_active_ratio_on_backpressure(
    state: dict,
    bp_snapshot: dict[str, Any],
) -> float | None:
    """
    Called from live_tick when backpressure snapshot is known.
    Updates Redis live state when ratio is lowered. Returns new ratio or None.
    """
    global _last_profile_auto_lower_log_at
    from activities import simulator_state as sim

    if not bp_snapshot.get("routing_backpressure_active"):
        prev = int(state.get("routing_bp_consecutive_ticks") or 0)
        if prev:
            sim.set_live_state(routing_bp_consecutive_ticks=0)
        return None

    try:
        consecutive = int(state.get("routing_bp_consecutive_ticks") or 0)
    except (TypeError, ValueError):
        consecutive = 0
    current = float(state.get("active_ratio", 0.25) or 0.25)

    new_ratio, new_consecutive, did_lower = evaluate_backpressure_active_ratio_lower(
        backpressure_active=True,
        consecutive_bp_ticks=consecutive,
        current_active_ratio=current,
    )
    sim.set_live_state(routing_bp_consecutive_ticks=new_consecutive)
    if not did_lower:
        return None

    sim.set_live_state(active_ratio=new_ratio)
    now = time.time()
    if now - _last_profile_auto_lower_log_at >= _PROFILE_LOG_INTERVAL_S:
        _last_profile_auto_lower_log_at = now
        msg = (
            f"Auto-lowered active_ratio {current:.3f} → {new_ratio:.3f} "
            f"after {backpressure_lower_after_ticks()} backpressure ticks"
        )
        logger.info(
            "sim.profile.auto_lower", extra={"event": "sim.profile.auto_lower", "detail": msg}
        )
        sim.live_log(msg)
    return new_ratio
