"""Runtime database-role safety guard for production RLS enforcement.

T73 requires the application runtime to connect with a PostgreSQL role that
cannot bypass row-level security. Schema/migration tooling may use a different
privileged connection, but web and worker runtimes must not run as SUPERUSER
or with BYPASSRLS.
"""

from __future__ import annotations

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
    """Raised when the production runtime role can bypass PostgreSQL RLS."""


def get_runtime_database_role() -> RuntimeDatabaseRole:
    """Read the effective PostgreSQL role and its RLS-bypass capabilities."""

    if connection.vendor != "postgresql":
        raise UnsafeRuntimeDatabaseRole(
            "4VELO production runtime requires PostgreSQL for row-level security"
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


def enforce_production_runtime_database_role() -> RuntimeDatabaseRole | None:
    """Enforce the role contract only in a detected production runtime."""

    if not is_production_runtime(debug=settings.DEBUG):
        return None
    return assert_runtime_database_role_safe()
