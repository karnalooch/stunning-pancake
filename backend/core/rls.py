"""4VELO PostgreSQL Row-Level Security helpers.

This module is the runtime companion to the canonical RLS policies installed
by:

* ``backend/activities/migrations/0036_canonical_fourvelo_rls.py``
* ``backend/users/migrations/0022_canonical_fourvelo_rls.py``

Contract:

* Policies are bound to ``PUBLIC`` (the runtime connection role). No
  application-specific PostgreSQL role is created; the runtime connects as
  the ``DATABASE_URL`` user and is bound by ``FORCE ROW LEVEL SECURITY``.
* Two GUCs carry the scope:

  - ``app.tenant_id`` - canonical UUID for tenant-scoped access.
  - ``app.is_global_owner`` - canonical literal ``'true'`` to allow
    GLOBAL_OWNER access; any other value (including the empty string) is
    fail-closed.

* Empty / missing GUCs mean "no access" - never "global access".
* Every helper uses parameterized SQL - no string interpolation of caller
  values into SQL.
* :func:`tenant_context` and :func:`global_owner_context` are context
  managers with deterministic cleanup in ``finally``.
* The low-level helpers refuse to set GLOBAL_OWNER from anything other than
  the canonical ``'true'`` literal; callers must decide GLOBAL_OWNER scope
  based on the authenticated ``request.user.role``, never on request
  parameters.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Iterator
from contextlib import contextmanager

from django.db import connection

logger = logging.getLogger(__name__)


APP_TENANT_GUC = "app.tenant_id"
APP_GLOBAL_OWNER_GUC = "app.is_global_owner"

# Canonical literal stored in ``app.is_global_owner``. Any other value
# (including empty string or ``'1'``/``'yes'``) leaves RLS fail-closed.
GLOBAL_OWNER_TRUE_VALUE = "true"


class InvalidTenantContext(ValueError):
    """Raised when a tenant id cannot be validated for the RLS context."""


def _validate_tenant_id(tenant_id: uuid.UUID | str | None) -> str | None:
    """Validate and normalize a tenant id to a canonical UUID string.

    Returns ``None`` for explicit ``None`` or empty-string input - these are
    the only inputs that produce a "clear context" outcome.
    """
    if tenant_id is None:
        return None
    if isinstance(tenant_id, str) and tenant_id.strip() == "":
        return None
    try:
        return str(uuid.UUID(str(tenant_id)))
    except (TypeError, ValueError, AttributeError) as exc:
        raise InvalidTenantContext(f"not a valid UUID: {tenant_id!r}") from exc


def _clear_session_guc(name: str) -> None:
    with connection.cursor() as cursor:
        # ``set_config(name, '', is_local=false)`` overrides any prior
        # session value with an empty string. The empty string is then
        # converted to NULL by ``NULLIF`` inside the policy expressions,
        # satisfying the fail-closed contract.
        cursor.execute("SELECT set_config(%s, '', false);", [name])


def _set_session_guc(name: str, value: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT set_config(%s, %s, false);",
            [name, value],
        )


def clear_tenant_context() -> None:
    """Clear ``app.tenant_id`` for the current connection."""
    _clear_session_guc(APP_TENANT_GUC)


def clear_global_owner_context() -> None:
    """Clear ``app.is_global_owner`` for the current connection."""
    _clear_session_guc(APP_GLOBAL_OWNER_GUC)


def clear_all_context() -> None:
    """Clear both ``app.tenant_id`` and ``app.is_global_owner``."""
    clear_tenant_context()
    clear_global_owner_context()


def set_tenant_context(tenant_id: uuid.UUID | str) -> str:
    """Set ``app.tenant_id`` for the current connection (no automatic cleanup).

    Also clears ``app.is_global_owner`` so the tenant scope takes precedence.
    """
    normalized = _validate_tenant_id(tenant_id)
    if normalized is None:
        raise InvalidTenantContext("set_tenant_context requires a non-empty UUID")
    clear_global_owner_context()
    _set_session_guc(APP_TENANT_GUC, normalized)
    return normalized


def set_global_owner_context() -> str:
    """Set ``app.is_global_owner = 'true'`` for the current connection.

    Also clears ``app.tenant_id`` so the global scope takes precedence. This
    helper accepts no caller-supplied value because the only legitimate
    trigger is the authenticated ``request.user.role == 'GLOBAL_OWNER'``;
    no client input is ever used to grant global-owner scope.
    """
    clear_tenant_context()
    _set_session_guc(APP_GLOBAL_OWNER_GUC, GLOBAL_OWNER_TRUE_VALUE)
    return GLOBAL_OWNER_TRUE_VALUE


@contextmanager
def tenant_context(tenant_id: uuid.UUID | str | None) -> Iterator[str | None]:
    """Set ``app.tenant_id`` for the lifetime of the block.

    Cleanup runs in ``finally`` so both GUCs are always reset, even on
    exceptions, rollbacks, or unexpected exits.
    """
    normalized = _validate_tenant_id(tenant_id)
    try:
        if normalized is not None:
            set_tenant_context(normalized)
        else:
            clear_all_context()
        yield normalized
    finally:
        try:
            clear_all_context()
        except Exception:  # pragma: no cover - defensive
            logger.exception(
                "tenant_context: failed to reset %s / %s",
                APP_TENANT_GUC,
                APP_GLOBAL_OWNER_GUC,
            )


@contextmanager
def global_owner_context() -> Iterator[str]:
    """Set ``app.is_global_owner = 'true'`` for the lifetime of the block.

    Cleanup runs in ``finally`` and always clears both GUCs. The context
    manager has no argument by design: GLOBAL_OWNER scope is a property of
    the authenticated principal, never of caller-supplied data.
    """
    try:
        set_global_owner_context()
        yield GLOBAL_OWNER_TRUE_VALUE
    finally:
        try:
            clear_all_context()
        except Exception:  # pragma: no cover - defensive
            logger.exception(
                "global_owner_context: failed to reset %s / %s",
                APP_TENANT_GUC,
                APP_GLOBAL_OWNER_GUC,
            )


__all__ = [
    "APP_TENANT_GUC",
    "APP_GLOBAL_OWNER_GUC",
    "GLOBAL_OWNER_TRUE_VALUE",
    "InvalidTenantContext",
    "clear_tenant_context",
    "clear_global_owner_context",
    "clear_all_context",
    "set_tenant_context",
    "set_global_owner_context",
    "tenant_context",
    "global_owner_context",
]
