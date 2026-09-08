"""
Shared live-simulation start logic (HTTP view + post-batch Celery worker).
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from . import simulator_state as sim

logger = logging.getLogger("activities.simulator")


def setup_live_athlete_pool(total_users: int) -> int:
    """Populate Redis live pool (or DB sampling mode) before the first live tick."""
    from activities.scale_config import compute_batch_scaling

    pool_plan = compute_batch_scaling(max(int(total_users), 1))
    if pool_plan["live_pool_mode"] == "db":
        pool_size = sim.init_live_pool_db_mode(total_users)
    else:
        pool_size = sim.set_live_pool_from_db(pool_plan["live_pool_redis_cap"])
    return pool_size


def _parse_auto_start_params(raw: str | None) -> dict[str, Any] | None:
    if not raw or str(raw).strip().lower() in ("", "none", "null", "false", "0"):
        return None
    try:
        data = json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def store_auto_start_live_params(params: dict[str, Any] | None) -> None:
    """Persist launch profile on batch state for worker auto-start after finalize."""
    if not params:
        sim.set_batch_state(auto_start_live="false", auto_start_live_params="")
        return
    sim.set_batch_state(
        auto_start_live="true",
        auto_start_live_params=json.dumps(params, separators=(",", ":")),
    )


def maybe_auto_start_live_after_batch() -> dict[str, Any]:
    """
    Start live sim on the simulation worker when batch POST requested auto_start_live.
    Call only after batch lock is released.
    """
    state = sim.get_batch_state()
    if str(state.get("auto_start_live", "")).lower() not in ("1", "true", "yes"):
        return {"started": False, "reason": "auto_start_disabled"}

    params = _parse_auto_start_params(state.get("auto_start_live_params"))
    if not params:
        return {"started": False, "reason": "missing_params"}

    if sim.get_live_state().get("running"):
        return {"started": False, "reason": "already_running"}

    blocked, block_reason = sim.batch_blocks_live_simulation()
    if blocked:
        sim.batch_log(
            f"Auto-start live skipped: batch still blocking ({block_reason}). "
            "Use Start Live in admin or POST /live-simulate/."
        )
        return {"started": False, "reason": block_reason}

    result = start_live_simulation_internal(params, source="batch_auto_start")
    if result.get("ok"):
        sim.batch_log("Auto-start live simulation after batch complete.")
    else:
        err = result.get("error") or "unknown"
        sim.batch_log(f"Auto-start live failed: {err[:240]}")
    return {"started": bool(result.get("ok")), **result}


def start_live_simulation_internal(
    data: dict[str, Any],
    *,
    source: str = "api",
) -> dict[str, Any]:
    """
    Core live start (no DRF Response). Returns {ok: True, ...} or {ok: False, error: ...}.
    """
    from activities import wipe_state as ws
    from activities.admin_views import _bootstrap_live_athletes
    from activities.scale_config import (
        parse_scale_overrides_from_state,
        parse_scale_overrides_payload,
        resolve_live_scale_limits,
        scale_overrides_for_storage,
    )
    from activities.sim_lab_proxy import assert_prod_heavy_sim_allowed
    from activities.sim_profile import parse_intensity_load_from_request
    from activities.simulator_tasks import live_tick_task, run_live_simulation

    if ws.is_wipe_in_progress():
        return {"ok": False, "error": "Wipe is in progress", "code": "WIPE_IN_PROGRESS"}

    state = sim.get_live_state()
    if state.get("running"):
        return {"ok": False, "error": "Live simulation already running", "code": "ALREADY_RUNNING"}

    blocked, block_reason = sim.batch_blocks_live_simulation()
    if blocked:
        return {
            "ok": False,
            "error": f"Batch simulation is still in progress ({block_reason})",
            "code": "BATCH_IN_PROGRESS",
            "batch_block_reason": block_reason,
        }

    pool_pct = float(data.get("pool_pct", 0.5))
    profile, profile_err = parse_intensity_load_from_request(data)
    if profile_err:
        return {"ok": False, "error": profile_err, "code": "INVALID_PROFILE"}

    sim_intensity = None
    sim_load = None
    scale_json = None
    scale_parsed = None

    if profile:
        active_ratio = float(profile["active_ratio"])
        cheat_ratio = float(profile["cheat_ratio"])
        tick_seconds = int(profile["tick_seconds"])
        scale_parsed = parse_scale_overrides_payload(profile["scale_overrides"])
        scale_json = scale_overrides_for_storage(scale_parsed)
        sim_intensity = profile["intensity"]
        sim_load = profile["load"]
    else:
        active_ratio = float(data.get("active_ratio", 0.3))
        cheat_ratio = float(data.get("cheat_ratio", 0.05))
        tick_seconds = int(data.get("tick_seconds", 10))
        raw_so = data.get("scale_overrides")
        if raw_so is not None:
            scale_parsed = parse_scale_overrides_payload(raw_so)
            if raw_so and scale_parsed is None:
                return {"ok": False, "error": "Invalid scale_overrides", "code": "INVALID_SCALE"}
            scale_json = scale_overrides_for_storage(scale_parsed) if scale_parsed else None

    if active_ratio <= 0 or active_ratio > 1:
        return {"ok": False, "error": "active_ratio must be 0–1", "code": "INVALID_PARAMS"}
    if cheat_ratio < 0 or cheat_ratio > 1:
        return {"ok": False, "error": "cheat_ratio must be 0–1", "code": "INVALID_PARAMS"}
    if tick_seconds < 2 or tick_seconds > 300:
        return {"ok": False, "error": "tick_seconds must be 2–300", "code": "INVALID_PARAMS"}

    if scale_parsed is None:
        batch_so = parse_scale_overrides_from_state(sim.get_batch_state())
        if batch_so:
            scale_parsed = batch_so
            scale_json = scale_overrides_for_storage(batch_so)

    validation = sim.validate_athlete_pool(min_users=10)
    if not validation["has_athletes"]:
        seeded = _bootstrap_live_athletes(min_users=500)
        validation = sim.validate_athlete_pool(min_users=10)
        if not validation["has_athletes"]:
            return {
                "ok": False,
                "error": validation["error"],
                "code": "NO_ATHLETES",
                "bootstrap_attempted": True,
                "athletes_after_bootstrap": seeded.get("total", 0),
            }

    from users.models import User

    total_athletes = User.objects.filter(role="ATHLETE").count()
    total_users = max(10, int(total_athletes * pool_pct))
    target_active = max(1, int(total_users * active_ratio))
    blocked_prod = assert_prod_heavy_sim_allowed(target_active=target_active)
    if blocked_prod is not None:
        return {
            "ok": False,
            "error": blocked_prod.data.get("error", "Prod heavy sim blocked"),
            "code": blocked_prod.data.get("code", "PROD_HEAVY_SIM_BLOCKED"),
        }

    pool_guard_notes: list[str] = []
    if profile is None:
        from activities.sim_live_guards import clamp_live_params_for_large_pool

        clamped = clamp_live_params_for_large_pool(total_users, active_ratio, tick_seconds)
        active_ratio = clamped.active_ratio
        tick_seconds = clamped.tick_seconds
        pool_guard_notes = list(clamped.notes)
        for note in pool_guard_notes:
            sim.live_log(f"Large pool guard: {note}")

    try:
        from activities.railway_osrm_lifecycle import scale_osrm_for_live_sim

        osrm_scale = scale_osrm_for_live_sim(running=True)
        if osrm_scale.action == "scaled_up":
            if osrm_scale.osrm_ready:
                sim.live_log(
                    f"OSRM Railway: scaled to 1 replica; health OK after {osrm_scale.osrm_wait_seconds}s."
                )
            elif osrm_scale.osrm_ready is False:
                sim.live_log(
                    f"OSRM Railway: scaled up but not healthy yet ({osrm_scale.detail}). "
                    "Routing should use auto/BRouter until OSRM is warm."
                )
            else:
                sim.live_log("OSRM Railway: scaled to 1 replica.")
        elif osrm_scale.action == "failed":
            sim.live_log(f"OSRM Railway scale-up failed: {osrm_scale.detail}")
    except Exception:
        logger.exception("sim.live_start.osrm_scale", extra={"source": source})

    if "sqlite" in os.getenv("DATABASE_URL", ""):
        blocked, block_reason = sim.batch_blocks_live_simulation()
        if blocked:
            return {
                "ok": False,
                "error": "Batch simulation is still in progress.",
                "code": "BATCH_IN_PROGRESS",
                "batch_block_reason": block_reason,
            }
        sim.reset_live_state()
        live_kw = {
            "running": True,
            "started_at": time.time(),
            "total_users": total_users,
            "active_ratio": active_ratio,
            "cheat_ratio": cheat_ratio,
            "tick_seconds": tick_seconds,
            "currently_riding": 0,
            "total_completed": 0,
            "cheaters_caught": 0,
            "last_tick_at": time.time(),
        }
        if scale_json:
            live_kw["scale_overrides"] = scale_json
        if sim_intensity is not None:
            live_kw["sim_intensity"] = sim_intensity
            live_kw["sim_load"] = sim_load
        sim.set_live_state(**live_kw)
        pool_size = setup_live_athlete_pool(total_users)
        if pool_size < total_users:
            total_users = pool_size
            sim.set_live_state(total_users=total_users)
        sim.live_log(f"LIVE SIM ({source}): pool={pool_size} users (SQLite).")
        live_tick_task.delay()
        sim.start_live_tick_loop()
    else:
        if sim.is_live_lock_held() and not state.get("running"):
            sim.release_live_lock()
        if not sim.acquire_live_lock():
            return {
                "ok": False,
                "error": "Live simulation lock is held. Use Stop or Reset Simulator.",
                "code": "LIVE_LOCK_HELD",
            }
        sim.reset_live_state()
        live_kw = {
            "running": True,
            "started_at": time.time(),
            "total_users": total_users,
            "active_ratio": active_ratio,
            "cheat_ratio": cheat_ratio,
            "tick_seconds": tick_seconds,
            "currently_riding": 0,
            "total_completed": 0,
            "cheaters_caught": 0,
            "last_tick_at": time.time(),
            "error": None,
        }
        if scale_json:
            live_kw["scale_overrides"] = scale_json
        if sim_intensity is not None:
            live_kw["sim_intensity"] = sim_intensity
            live_kw["sim_load"] = sim_load
        sim.set_live_state(**live_kw)
        pool_target = total_users
        pool_size = setup_live_athlete_pool(pool_target)
        if pool_size < pool_target:
            total_users = pool_size
            sim.set_live_state(total_users=total_users)
            sim.live_log(
                f"WARNING: pool has {pool_size} athletes (wanted {pool_target}). "
                "Target on map scaled to pool size."
            )
        sim.live_log(f"LIVE SIM ({source}): pool={pool_size} athletes ready.")
        run_live_simulation.delay()

    limits = resolve_live_scale_limits(sim.get_live_state())
    return {
        "ok": True,
        "total_users": total_users,
        "active_ratio": active_ratio,
        "pool_size": pool_size,
        "effective_scale_limits": limits,
        "pool_guard_notes": pool_guard_notes,
    }
