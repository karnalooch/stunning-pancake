"""Tenant-scope boundary for Celery workers.

T73 makes PostgreSQL RLS context explicit at the asynchronous task boundary.
Trusted producers may attach exactly one of the headers below. Every task
starts from a cleared context and the context is cleared again on return, so a
pooled worker connection cannot inherit another task's tenant privileges.
"""

from __future__ import annotations

import uuid
from typing import Any

from celery import Task

from core.rls import clear_all_context, set_global_owner_context, set_tenant_context

TENANT_TASK_HEADER = "4velo_tenant_id"
GLOBAL_OWNER_TASK_HEADER = "4velo_global_owner"


class InvalidTaskRLSContext(ValueError):
    """Raised when an internal task carries an invalid or ambiguous RLS scope."""


def tenant_task_headers(tenant_id: uuid.UUID | str) -> dict[str, object]:
    """Build a validated tenant header for a trusted Celery producer."""

    try:
        normalized = str(uuid.UUID(str(tenant_id)))
    except (TypeError, ValueError, AttributeError) as exc:
        raise InvalidTaskRLSContext(f"invalid tenant id: {tenant_id!r}") from exc
    return {TENANT_TASK_HEADER: normalized}


def global_owner_task_headers() -> dict[str, object]:
    """Build the explicit header used only by trusted cross-tenant maintenance jobs."""

    return {GLOBAL_OWNER_TASK_HEADER: True}


def task_headers_for_user(user: Any) -> dict[str, object]:
    """Derive worker scope from an authenticated server-side user object."""

    if getattr(user, "role", None) == "GLOBAL_OWNER":
        return global_owner_task_headers()
    tenant_id = getattr(user, "tenant_id", None)
    if tenant_id is None:
        raise InvalidTaskRLSContext("tenant-scoped task requires user.tenant_id")
    return tenant_task_headers(tenant_id)


def apply_task_rls_scope(headers: dict[str, object] | None) -> None:
    """Clear stale DB scope and apply one validated scope from trusted task headers."""

    clear_all_context()
    headers = headers or {}
    tenant_id = headers.get(TENANT_TASK_HEADER)
    global_owner = headers.get(GLOBAL_OWNER_TASK_HEADER)

    if tenant_id not in (None, "") and global_owner is not None:
        clear_all_context()
        raise InvalidTaskRLSContext("task cannot carry tenant and global-owner scope together")

    if global_owner is not None:
        if global_owner is not True:
            clear_all_context()
            raise InvalidTaskRLSContext("global-owner task scope must be boolean true")
        set_global_owner_context()
        return

    if tenant_id not in (None, ""):
        try:
            set_tenant_context(str(tenant_id))
        except Exception:
            clear_all_context()
            raise


class RLSScopedTask(Task):
    """Celery base task that prevents tenant GUC leakage between worker jobs."""

    abstract = True

    def before_start(self, task_id, args, kwargs):
        try:
            apply_task_rls_scope(getattr(self.request, "headers", None))
        except Exception:
            clear_all_context()
            raise
        return super().before_start(task_id, args, kwargs)

    def after_return(self, status, retval, task_id, args, kwargs, einfo):
        try:
            clear_all_context()
        finally:
            return super().after_return(status, retval, task_id, args, kwargs, einfo)
