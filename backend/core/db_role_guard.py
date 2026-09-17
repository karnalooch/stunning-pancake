"""Runtime database-role safety guard for RLS enforcement.

T73 requires application runtimes to connect with a PostgreSQL role that
cannot bypass row-level security. Schema/migration tooling may use a different
privileged connection, but web and worker runtimes must not run as SUPERUSER
or with BYPASSRLS.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from django.conf import settings
from django.db import connection

from core.production_guards import is_production_runtime


@dataclass(frozen=True, slots=True)
class RuntimeDatabaseRole:
    name: str
    is_superuser: bool
    bypasses_rls: bool


class UnsafeRuntimeDatabaseRole(RuntimeError):
    """Raised when a guarded runtime role can bypass PostgreSQL RLS."""


def get_runtime_database_role() -> RuntimeDatabaseRole:
    """Read the effective PostgreSQL role and its RLS-bypass capabilities."""

    if connection.vendor != "postgresql":
        raise UnsafeRuntimeDatabaseRole(
            "4VELO guarded runtime requires PostgreSQL for row-level security"
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT current_user, rolsuper, rolbypassrls
            FROM pg_roles
            WHERE rolname = current_user
            """
        )
        row = cursor.fetchone()

    if row is None:
        raise UnsafeRuntimeDatabaseRole("current PostgreSQL runtime role was not found")

    return RuntimeDatabaseRole(
        name=str(row[0]),
        is_superuser=bool(row[1]),
        bypasses_rls=bool(row[2]),
    )


def assert_runtime_database_role_safe() -> RuntimeDatabaseRole:
    """Fail when the effective role can bypass RLS."""

    role = get_runtime_database_role()
    unsafe = []
    if role.is_superuser:
        unsafe.append("SUPERUSER")
    if role.bypasses_rls:
        unsafe.append("BYPASSRLS")
    if unsafe:
        capabilities = ", ".join(unsafe)
        raise UnsafeRuntimeDatabaseRole(
            f"runtime database role {role.name!r} is unsafe for RLS: {capabilities}"
        )
    return role


def runtime_database_role_guard_required() -> bool:
    """Return whether this runtime must prove a non-bypass PostgreSQL role.

    Production can never opt out. Pilot/home-lab environments can opt in even
    with DEBUG=1 through ``RLS_RUNTIME_ROLE_GUARD=1`` so the release rehearsal
    exercises the same fail-closed role contract as production.
    """

    explicit = os.getenv("RLS_RUNTIME_ROLE_GUARD", "0").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    return explicit or is_production_runtime(debug=settings.DEBUG)


def enforce_runtime_database_role_if_required() -> RuntimeDatabaseRole | None:
    """Enforce the T73 role contract for production and opted-in pilot runtimes."""

    if not runtime_database_role_guard_required():
        return None
    return assert_runtime_database_role_safe()
