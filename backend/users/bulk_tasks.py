"""
Celery tasks for chunked async bulk user actions.
"""

from __future__ import annotations

from celery import shared_task
from django.db import transaction

from users.bulk_state import bulk_log, mark_complete, mark_error, mark_running, set_state

CHUNK_SIZE = 500


@shared_task(
    bind=True,
    queue="default",
    max_retries=0,
    name="users.bulk_tasks.bulk_action_task",
)
def bulk_action_task(
    self,
    job_id: str,
    action: str,
    user_ids: list[int],
    *,
    role: str | None = None,
    update_tenant: bool = False,
    tenant_id: str | None = None,
    desired_is_active: bool | None = None,
):
    """
    action:
      - "set_status" (desired_is_active must be provided)
      - "change_role" (role must be provided)
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()

    try:
        mark_running(job_id, message=f"starting {action}")

        total = len(user_ids)
        processed = 0

        # Process in chunks to avoid long transactions and reduce lock time.
        for i in range(0, total, CHUNK_SIZE):
            batch = user_ids[i : i + CHUNK_SIZE]
            if not batch:
                continue

            if action == "set_status":
                if desired_is_active is None:
                    raise ValueError("desired_is_active is required for set_status")
                with transaction.atomic():
                    User.objects.filter(id__in=batch).update(is_active=bool(desired_is_active))

            elif action == "change_role":
                if not role:
                    raise ValueError("role is required for change_role")

                if role == "GLOBAL_OWNER":
                    # Tenant must be cleared for GLOBAL_OWNER.
                    with transaction.atomic():
                        User.objects.filter(id__in=batch).update(role=role, tenant_id=None)
                else:
                    update_kwargs: dict[str, object] = {"role": role}
                    if update_tenant:
                        # tenant_id may be null (explicitly clearing), but for tenant-scoped roles
                        # you typically want a real UUID from FE.
                        update_kwargs["tenant_id"] = tenant_id

                    with transaction.atomic():
                        User.objects.filter(id__in=batch).update(**update_kwargs)

            else:
                raise ValueError(f"Unknown bulk action: {action}")

            processed += len(batch)
            progress_pct = round((processed / max(total, 1)) * 100, 2)
            set_state(
                job_id, progress_pct=progress_pct, processed=processed, status=f"running:{action}"
            )
            bulk_log(job_id, f"{action}: processed {processed}/{total}")

        mark_complete(job_id, processed=processed, message=f"complete:{action}")
        return {"status": "complete", "processed": processed}

    except Exception as exc:
        mark_error(job_id, error=str(exc), processed=processed, message=f"error:{action}")
        bulk_log(job_id, f"ERROR: {exc}")
        return {"status": "error", "error": str(exc)}
