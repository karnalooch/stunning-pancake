"""Celery tasks for Garmin simulation — schedule, live tick chain, finish."""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    queue="simulation",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def schedule_garmin_rides(
    self,
    credentials: list[dict[str, str]],
    config_dict: dict | None = None,
    user_names: list[dict[str, str]] | None = None,
) -> dict:
    from activities.garmin_simulator import (
        release_garmin_batch_lock,
        schedule_rides,
        schedule_config_from_dict,
        set_garmin_batch_state,
    )

    task_id = self.request.id or ""
    config = schedule_config_from_dict(config_dict)

    try:
        result = schedule_rides(credentials, config, task_id=task_id, user_names=user_names)
        return result
    except Exception as exc:
        logger.exception("Garmin schedule task %s failed", task_id)
        set_garmin_batch_state(
            running=False,
            error=str(exc)[:500],
            phase="error",
        )
        release_garmin_batch_lock()
        try:
            self.retry(exc=exc)
        except Exception:
            pass
        return {"status": "error", "message": str(exc)}


@shared_task(
    queue="simulation",
    bind=True,
    max_retries=0,
    acks_late=True,
    reject_on_worker_lost=True,
)
def run_garmin_live_tick(
    self,
    ride_id: str,
    tick: int,
    duration_s: int,
) -> dict:
    try:
        from activities.garmin_simulator import run_live_tick
        return run_live_tick(ride_id, tick, duration_s)
    except Exception as exc:
        logger.exception("Garmin live tick %s/%d failed", ride_id, tick)
        if tick < duration_s:
            from activities.garmin_simulator import garmin_batch_log
            garmin_batch_log(f"ERROR: tick {tick} for {ride_id}: {exc} — retrying next tick")
            run_garmin_live_tick.apply_async(
                args=[ride_id, tick + 1, duration_s],
                countdown=1,
            )
        return {"status": "error", "ride_id": ride_id, "tick": tick, "error": str(exc)}


@shared_task(
    queue="simulation",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def finish_garmin_ride(
    self,
    ride_id: str,
) -> dict:
    try:
        from activities.garmin_simulator import finish_garmin_ride
        return finish_garmin_ride(ride_id)
    except Exception as exc:
        logger.exception("Garmin finish task for %s failed", ride_id)
        try:
            self.retry(exc=exc)
        except Exception:
            pass
        return {"status": "error", "ride_id": ride_id, "error": str(exc)}
