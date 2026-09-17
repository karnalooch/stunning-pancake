"""Tenant-scope boundary for Celery workers.

T73 makes PostgreSQL RLS context explicit at the asynchronous task boundary.
Trusted producers may attach exactly one of the headers below. Every task
starts from a cleared context and the context is cleared again on return, so a
pooled worker connection cannot inherit another task's tenant privileges.
"""

from __future__ import annotations

import uuid
from typing import Any

from celery import Task, current_task
from django.db import connection

from core.db_role_guard import enforce_production_runtime_database_role
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


def _trusted_parent_headers() -> dict[str, object]:
    """Copy only the RLS scope from the currently executing parent task."""

    try:
        parent_headers = getattr(current_task.request, "headers", None) or {}
    except Exception:
        return {}

    inherited: dict[str, object] = {}
    if TENANT_TASK_HEADER in parent_headers:
        inherited[TENANT_TASK_HEADER] = parent_headers[TENANT_TASK_HEADER]
    if GLOBAL_OWNER_TASK_HEADER in parent_headers:
        inherited[GLOBAL_OWNER_TASK_HEADER] = parent_headers[GLOBAL_OWNER_TASK_HEADER]
    return inherited


def _trusted_connection_headers() -> dict[str, object]:
    """Derive scope from the current request/command PostgreSQL GUCs.

    This covers top-level task dispatch from authenticated Django requests and
    explicitly-scoped management commands. Missing/invalid context produces no
    header, which leaves the worker fail-closed.
    """

    if connection.vendor != "postgresql":
        return {}
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    NULLIF(current_setting('app.tenant_id', true), ''),
                    NULLIF(current_setting('app.is_global_owner', true), '')
                """
            )
            row = cursor.fetchone()
    except Exception:
        return {}

    if not row:
        return {}
    tenant_id, global_owner = row
    if tenant_id and global_owner:
        raise InvalidTaskRLSContext("database connection carries ambiguous RLS scope")
    if global_owner is not None:
        if str(global_owner).lower() != "true":
            raise InvalidTaskRLSContext("database global-owner GUC is not canonical true")
        return global_owner_task_headers()
    if tenant_id:
        return tenant_task_headers(str(tenant_id))
    return {}


def _close_connection_after_scope_failure() -> None:
    """Discard a DB connection when its GUC cleanup cannot be trusted."""

    try:
        connection.close()
    except Exception:
        pass


def apply_task_rls_scope(
    headers: dict[str, object] | None,
    *,
    require_scope: bool = False,
) -> None:
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
        return

    if require_scope:
        raise InvalidTaskRLSContext("task requires an explicit tenant or global-owner RLS scope")


class RLSScopedTask(Task):
    """Default Celery task base that prevents GUC leakage between worker jobs."""

    abstract = True
    require_rls_scope = False

    def apply_async(self, args=None, kwargs=None, **options):
        # Child tasks inherit only the validated RLS scope, never arbitrary
        # parent headers. Top-level web/command dispatch may inherit only the
        # two server-controlled PostgreSQL GUCs.
        if "headers" not in options:
            inherited = _trusted_parent_headers() or _trusted_connection_headers()
            if inherited:
                options["headers"] = inherited
        return super().apply_async(args=args, kwargs=kwargs, **options)

    def before_start(self, task_id, args, kwargs):
        enforce_production_runtime_database_role()
        try:
            apply_task_rls_scope(
                getattr(self.request, "headers", None),
                require_scope=bool(self.require_rls_scope),
            )
        except Exception:
            try:
                clear_all_context()
            except Exception:
                _close_connection_after_scope_failure()
            raise
        return super().before_start(task_id, args, kwargs)

    def after_return(self, status, retval, task_id, args, kwargs, einfo):
        try:
            return super().after_return(status, retval, task_id, args, kwargs, einfo)
        finally:
            try:
                clear_all_context()
            except Exception:
                _close_connection_after_scope_failure()


class RequiredRLSScopedTask(RLSScopedTask):
    """Task base for work that must never execute without an explicit RLS scope."""

    abstract = True
    require_rls_scope = True
