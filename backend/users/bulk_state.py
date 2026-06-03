"""
Redis-backed progress for chunked async bulk user actions.
Mirrors activities.wipe_state but scoped to users.bulk jobs.
"""

from __future__ import annotations

import json
import time
from typing import Any

from core.redis_cluster import get_redis


def _state_key(job_id: str) -> str:
    # Hash-tag to keep all keys for a job in the same Redis cluster slot.
    return f"{{admin}}:users_bulk:{job_id}:state"


def _log_key(job_id: str) -> str:
    return f"{{admin}}:users_bulk:{job_id}:log"


def get_state(job_id: str) -> dict[str, Any]:
    r = get_redis()
    raw = r.hgetall(_state_key(job_id))
    if not raw:
        return {
            "running": False,
            "status": "idle",
            "progress_pct": 0,
            "processed": 0,
            "total": 0,
            "error": None,
            "message": None,
            "started_at": None,
            "completed_at": None,
            "action": None,
        }

    state = {
        (k.decode() if isinstance(k, bytes) else k): (v.decode() if isinstance(v, bytes) else v)
        for k, v in raw.items()
    }

    state["running"] = str(state.get("running", "false")).lower() == "true"
    state["progress_pct"] = float(state.get("progress_pct", 0))
    state["processed"] = int(state.get("processed", 0))
    state["total"] = int(state.get("total", 0))
    state["started_at"] = float(state["started_at"]) if state.get("started_at") else None
    state["completed_at"] = float(state["completed_at"]) if state.get("completed_at") else None

    if state.get("message") == "None":
        state["message"] = None
    if state.get("error") == "None":
        state["error"] = None

    return state


def set_state(job_id: str, **kwargs: Any) -> None:
    r = get_redis()
    mapping: dict[str, str] = {}
    for k, v in kwargs.items():
        if isinstance(v, (dict, list)):
            mapping[k] = json.dumps(v)
        elif v is None:
            mapping[k] = "None"
        else:
            mapping[k] = str(v)
    r.hset(_state_key(job_id), mapping=mapping)
    r.expire(_state_key(job_id), 86400)


def mark_queued(
    job_id: str,
    action: str,
    total: int,
    *,
    requester_id: int | None = None,
    requester_tenant_id: str | None = None,
) -> None:
    set_state(
        job_id,
        running=True,
        status="queued",
        progress_pct=0,
        processed=0,
        total=total,
        error=None,
        message="queued",
        started_at=time.time(),
        completed_at=None,
        action=action,
        requester_id=requester_id,
        requester_tenant_id=requester_tenant_id,
    )


def mark_running(job_id: str, message: str | None = None) -> None:
    set_state(
        job_id,
        running=True,
        status="running",
        message=message or "running",
    )


def mark_complete(job_id: str, processed: int, message: str | None = None) -> None:
    set_state(
        job_id,
        running=False,
        status="complete",
        progress_pct=100,
        processed=processed,
        message=message or "complete",
        completed_at=time.time(),
    )


def mark_error(job_id: str, error: str, processed: int = 0, message: str | None = None) -> None:
    set_state(
        job_id,
        running=False,
        status="error",
        error=error,
        processed=processed,
        message=message or "error",
        completed_at=time.time(),
    )


def bulk_log(job_id: str, msg: str) -> None:
    r = get_redis()
    ts = time.strftime("%H:%M:%S")
    r.rpush(_log_key(job_id), json.dumps([ts, msg]))
    r.ltrim(_log_key(job_id), -100, -1)


def get_log(job_id: str) -> list[list[str]] | list[Any]:
    r = get_redis()
    raw = r.lrange(_log_key(job_id), 0, -1)
    out: list[list[str]] = []
    for line in raw:
        try:
            out.append(json.loads(line.decode() if isinstance(line, bytes) else line))
        except Exception:
            continue
    return out
