"""
Automatic Postgres disk safeguards for batch simulation.

No manual wipe / disk monitoring required when SCALE_AUTO_DISK_GUARD is on (default).
Disk budget is auto-detected from pg_database_size (Railway tiers), volume mount, or env override.
"""

from __future__ import annotations

import os
import shutil
import time
from typing import Any

from django.contrib.auth import get_user_model
from django.db import connection

from activities.scale_config import (
    AUTO_DISK_GUARD,
    AUTO_WIPE_BEFORE_BATCH,
    BATCH_WARN_WITHOUT_WIPE_ABOVE,
    DISK_HEADROOM_GB,
    POSTGRES_DISK_BUDGET_GB_DEFAULT,
    POSTGRES_DISK_BUDGET_GB_FLOOR,
    WIPE_WAIT_TIMEOUT_SEC,
    compute_batch_scaling,
    estimate_batch_disk_gb,
)

# Standard Railway volume tiers (GB) — used to infer cap from pg_database_size
RAILWAY_VOLUME_TIERS_GB = (0.5, 5, 10, 20, 50, 100, 250, 500, 1024)

# Below this DB size, pg_database_size reflects empty/wiped DB, not the volume cap
EMPTY_DB_INFER_THRESHOLD_GB = 2.0

DISK_BUDGET_CACHE_KEY = "{sim}:disk:budget_gb"
DISK_BUDGET_CACHE_TTL = 86400 * 7


def is_disk_full_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "no space left on device" in msg or "could not extend file" in msg


def get_database_size_bytes() -> int | None:
    """Current DB size via pg_database_size (None if unavailable, e.g. SQLite)."""
    if connection.vendor != "postgresql":
        return None
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_database_size(current_database())")
            row = cursor.fetchone()
            return int(row[0]) if row else None
    except Exception:
        return None


def get_database_size_gb() -> float | None:
    nbytes = get_database_size_bytes()
    if nbytes is None:
        return None
    return round(nbytes / (1024**3), 3)


def infer_volume_cap_from_db_usage(db_gb: float) -> float:
    """Smallest standard volume tier that can hold current pg_database_size."""
    size = max(0.0, float(db_gb))
    for cap in RAILWAY_VOLUME_TIERS_GB:
        if size <= cap:
            return cap
    return RAILWAY_VOLUME_TIERS_GB[-1]


def _read_env_disk_budget_gb() -> float | None:
    val = os.getenv("SCALE_POSTGRES_DISK_BUDGET_GB")
    if val is None or str(val).strip() == "":
        return None
    try:
        return max(0.5, float(val))
    except (TypeError, ValueError):
        return None


def _disk_budget_from_volume_mount() -> float | None:
    """When this process has the Postgres volume mounted (Railway Postgres service)."""
    mount = os.getenv("RAILWAY_VOLUME_MOUNT_PATH", "").strip()
    if not mount or not os.path.isdir(mount):
        return None
    try:
        usage = shutil.disk_usage(mount)
        return round(usage.total / (1024**3), 3)
    except OSError:
        return None


def _disk_budget_from_redis_cache() -> float | None:
    try:
        from core.redis_cluster import get_redis

        r = get_redis()
        raw = r.get(DISK_BUDGET_CACHE_KEY)
        if not raw:
            return None
        val = raw.decode() if isinstance(raw, bytes) else raw
        return max(0.5, float(val))
    except Exception:
        return None


def remember_disk_budget_from_full_disk(db_gb: float | None = None) -> None:
    """Cache volume cap after a disk-full error (tightens future guards)."""
    size = db_gb if db_gb is not None else get_database_size_gb()
    if size is None or size <= 0:
        return
    cap = max(infer_volume_cap_from_db_usage(size), size * 1.02)
    try:
        from core.redis_cluster import get_redis

        r = get_redis()
        r.setex(DISK_BUDGET_CACHE_KEY, DISK_BUDGET_CACHE_TTL, str(round(cap, 3)))
    except Exception:
        pass


def resolve_disk_budget_gb(
    db_gb: float | None = None,
    *,
    batch_delta_gb: float | None = None,
) -> tuple[float, str]:
    """
    Postgres volume budget in GB.

    Priority: SCALE_POSTGRES_DISK_BUDGET_GB env → RAILWAY_VOLUME_MOUNT_PATH df
    → Redis (learned from prior disk-full) → infer from pg_database_size → default.

    After wipe, pg_database_size is tiny (e.g. 0.1 GB) — do not map that to the 0.5 GB
    tier (b071e14). Use POSTGRES_DISK_BUDGET_GB_FLOOR (5 GB) or env override, not an
    inflated guess that hides a full 5 GB Railway volume from the monitor.
    """
    env_b = _read_env_disk_budget_gb()
    if env_b is not None:
        return env_b, "env"

    mount_b = _disk_budget_from_volume_mount()
    if mount_b is not None:
        return mount_b, "railway_volume_mount"

    cached = _disk_budget_from_redis_cache()
    if cached is not None:
        return cached, "learned_cache"

    if db_gb is not None and db_gb > 0:
        if db_gb < EMPTY_DB_INFER_THRESHOLD_GB:
            # Fixed volume cap for monitor/preflight; projected batch growth is in _usage_ratio.
            return float(POSTGRES_DISK_BUDGET_GB_DEFAULT), "empty_db_floor"
        return infer_volume_cap_from_db_usage(db_gb), "inferred_pg_size"

    return POSTGRES_DISK_BUDGET_GB_DEFAULT, "default"


def warn_unconfigured_disk_budget(budget_gb: float | None, budget_source: str | None) -> None:
    """Log when budget relies on floor/default — ops should set SCALE_POSTGRES_DISK_BUDGET_GB."""
    import logging

    if budget_source not in ("empty_db_floor", "default"):
        return
    from activities.scale_config import is_postgres_disk_budget_env_set

    if is_postgres_disk_budget_env_set():
        return

    log = logging.getLogger(__name__)
    railway = bool(os.getenv("RAILWAY_SERVICE_NAME") or os.getenv("RAILWAY_ENVIRONMENT"))
    hint = (
        "Set SCALE_POSTGRES_DISK_BUDGET_GB to your Postgres volume size "
        f"(Railway common cap: {POSTGRES_DISK_BUDGET_GB_FLOOR:g} GB)."
    )
    if railway:
        hint = (
            "Railway detected — set SCALE_POSTGRES_DISK_BUDGET_GB on backend and "
            f"celery-worker-simulation (e.g. {POSTGRES_DISK_BUDGET_GB_FLOOR:g} for 5 GB volumes). "
            + hint
        )
    log.warning(
        "disk_guard: Postgres budget ~%s GB from %s (%s)",
        budget_gb,
        budget_source,
        hint,
    )


def _usage_ratio(
    db_gb: float | None,
    projected_delta_gb: float,
) -> tuple[float | None, float | None, str | None]:
    if db_gb is None:
        return None, None, None
    budget, source = resolve_disk_budget_gb(db_gb, batch_delta_gb=projected_delta_gb)
    projected = db_gb + projected_delta_gb + float(DISK_HEADROOM_GB)
    return projected / budget, budget, source


def adjust_batch_plan_for_disk_pressure(
    plan: dict,
    *,
    usage_ratio: float | None,
) -> dict:
    """Reduce PG chunk and parallel workers when projected usage is high."""
    out = dict(plan)
    if usage_ratio is None:
        return out

    pg = int(out.get("user_bulk_pg_batch_size", 500))
    parallel = int(out.get("max_parallel_workers", 4))
    bulk = int(out.get("user_bulk_batch_size", 2500))

    if usage_ratio >= 1.0:
        pg = max(50, pg // 4)
        parallel = max(1, min(parallel, 2))
        bulk = max(1000, bulk // 2)
    elif usage_ratio >= 0.85:
        pg = max(50, pg // 2)
        parallel = max(1, min(parallel, 3))
    elif usage_ratio >= 0.7:
        pg = max(50, int(pg * 0.75))
        parallel = max(1, min(parallel, max(2, parallel - 1)))

    out["user_bulk_pg_batch_size"] = pg
    out["user_bulk_batch_size"] = bulk
    out["max_parallel_workers"] = parallel
    out["max_parallel_cities"] = min(int(out.get("num_cities", 10)), parallel)
    out["disk_usage_ratio"] = round(usage_ratio, 3)
    return out


def wait_for_wipe_completed(timeout_sec: float | None = None, poll_sec: float = 2.0) -> bool:
    from activities import wipe_state as ws

    deadline = time.time() + float(timeout_sec or WIPE_WAIT_TIMEOUT_SEC)
    while time.time() < deadline:
        state = ws.get_wipe_state()
        if not state.get("running"):
            return ws.wipe_status_label(state) == "complete" and not state.get("error")
        time.sleep(poll_sec)
    return False


def _should_auto_wipe(
    target_users: int,
    athlete_count: int,
    *,
    skip_activities: bool,
    db_gb: float | None,
    clear: bool,
) -> tuple[bool, str]:
    if not AUTO_WIPE_BEFORE_BATCH:
        return False, ""

    estimated = estimate_batch_disk_gb(target_users, skip_activities=skip_activities)
    ratio, _budget, _src = _usage_ratio(db_gb, estimated)

    if clear and athlete_count > 0:
        return True, "clear=true — automatyczny wipe przed batch"

    if target_users >= BATCH_WARN_WITHOUT_WIPE_ABOVE and athlete_count > 0:
        if athlete_count >= target_users * 0.25:
            return True, (f"re-seed: {athlete_count:,} athlete w bazie, cel {target_users:,}")
        if ratio is not None and ratio >= 0.75:
            return True, (
                f"dysk: szac. {ratio * 100:.0f}% budżetu po batchu "
                f"({db_gb:.1f} + ~{estimated:.1f} GB)"
            )

    if ratio is not None and ratio >= 0.9:
        return True, f"dysk krytyczny ({ratio * 100:.0f}% budżetu)"

    return False, ""


def prepare_batch_disk_guard(
    target_users: int,
    *,
    skip_activities: bool = True,
    clear: bool = False,
) -> dict[str, Any]:
    """
    Run before batch insert: optional auto-wipe, tune chunk sizes, or abort if impossible.

    Returns { ok, batch_plan, actions[], error?, db_size_gb, disk_usage_ratio? }.
    """
    target = max(0, int(target_users))
    actions: list[str] = []

    if not AUTO_DISK_GUARD or target < 1_000:
        plan = compute_batch_scaling(max(1, target)) if target else {}
        return {
            "ok": True,
            "batch_plan": plan,
            "actions": actions,
            "db_size_gb": get_database_size_gb(),
        }

    User = get_user_model()
    athlete_count = User.objects.filter(role="ATHLETE").count()
    db_gb = get_database_size_gb()
    estimated = estimate_batch_disk_gb(target, skip_activities=skip_activities)
    plan = compute_batch_scaling(target)

    do_wipe, wipe_reason = _should_auto_wipe(
        target,
        athlete_count,
        skip_activities=skip_activities,
        db_gb=db_gb,
        clear=clear,
    )

    if do_wipe:
        from activities import wipe_state as ws
        from activities.wipe_tasks import run_wipe_sync

        if ws.get_wipe_state().get("running"):
            actions.append("Oczekiwanie na trwający wipe…")
            if not wait_for_wipe_completed():
                return {
                    "ok": False,
                    "error": "Automatyczny wipe: timeout — spróbuj ponownie później.",
                    "batch_plan": plan,
                    "actions": actions,
                    "db_size_gb": db_gb,
                }
        else:
            actions.append(f"Automatyczny wipe: {wipe_reason}")
            result = run_wipe_sync()
            if result.get("status") == "locked":
                if not wait_for_wipe_completed():
                    return {
                        "ok": False,
                        "error": "Automatyczny wipe: nie udało się uzyskać blokady.",
                        "batch_plan": plan,
                        "actions": actions,
                        "db_size_gb": db_gb,
                    }
            elif result.get("status") != "complete":
                return {
                    "ok": False,
                    "error": f"Automatyczny wipe nie powiódł się: {result.get('error', result)}",
                    "batch_plan": plan,
                    "actions": actions,
                    "db_size_gb": db_gb,
                }
            actions.append("Wipe zakończony.")
            db_gb = get_database_size_gb()
            athlete_count = 0

    ratio, budget_gb, budget_source = _usage_ratio(db_gb, estimated)
    plan = adjust_batch_plan_for_disk_pressure(plan, usage_ratio=ratio)

    warn_unconfigured_disk_budget(budget_gb, budget_source)

    if budget_gb is not None and budget_source:
        src_labels = {
            "env": "env",
            "railway_volume_mount": "wolumen Railway (df)",
            "inferred_pg_size": "wykryto z rozmiaru bazy",
            "empty_db_floor": "pusta baza — domyślny budżet wolumenu",
            "learned_cache": "po wcześniejszym błędzie dysku",
            "default": "domyślny",
        }
        actions.insert(
            0,
            f"Budżet dysku Postgres: ~{budget_gb:g} GB ({src_labels.get(budget_source, budget_source)}).",
        )

    if ratio is not None and ratio > 1.15 and budget_source not in ("empty_db_floor", "default"):
        return {
            "ok": False,
            "error": (
                f"Za mało miejsca na Postgres (wykryty budżet ~{budget_gb or 0:g} GB, "
                f"baza ~{db_gb or 0:.1f} GB, batch ~{estimated:.1f} GB). "
                f"Powiększ wolumen w Railway lub ustaw SCALE_POSTGRES_DISK_BUDGET_GB."
            ),
            "batch_plan": plan,
            "actions": actions,
            "db_size_gb": db_gb,
            "disk_usage_ratio": ratio,
            "disk_budget_gb": budget_gb,
            "disk_budget_source": budget_source,
        }

    if ratio is not None and ratio >= 0.7:
        actions.append(
            f"Dopasowano inserty: pg_chunk={plan['user_bulk_pg_batch_size']}, "
            f"parallel≤{plan['max_parallel_workers']} "
            f"(dysk ~{ratio * 100:.0f}% budżetu)."
        )

    return {
        "ok": True,
        "batch_plan": plan,
        "actions": actions,
        "db_size_gb": db_gb,
        "disk_usage_ratio": ratio,
        "disk_budget_gb": budget_gb,
        "disk_budget_source": budget_source,
        "athletes_in_db": athlete_count,
    }
