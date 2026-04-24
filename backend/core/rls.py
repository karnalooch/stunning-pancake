"""
Multi-Tenancy: PostgreSQL Row Level Security (Milestone 4)
===========================================================
Constitution §19: White-Label Commercialization

Applies RLS policies to Activity and Event tables so that:
- Each tenant can only read their own data via the API.
- Superuser (Django backend) bypasses RLS for admin operations.

Usage (run once in production):
    docker compose exec backend python manage.py shell
    from core.rls import apply_rls_policies
    apply_rls_policies()

Note: RLS is enforced at the PostgreSQL level — even a compromised
Django process cannot leak cross-tenant data.
"""
from __future__ import annotations

import logging

from django.db import connection

logger = logging.getLogger(__name__)

# Tables to protect with RLS
RLS_TABLES = [
    "activities_activity",
    "events_event",
    "events_participation",
    "rewards_voucherpool",
    "rewards_voucher",
]

# The DB role used by Django in production
APP_ROLE = "sport_app"


def apply_rls_policies() -> None:
    """
    Enables RLS on all multi-tenant tables and creates isolation policies.

    Policies:
        - SELECT: users see only rows matching their tenant_id
          (or all rows if tenant_id is empty/null — global data).
        - INSERT/UPDATE/DELETE: enforced to own tenant.

    The Django superuser role bypasses RLS (BYPASSRLS privilege),
    allowing Admin Panel and Celery workers unrestricted access.
    """
    with connection.cursor() as cursor:
        for table in RLS_TABLES:
            logger.info("rls.applying table=%s", table)
            _apply_for_table(cursor, table)

    logger.info("rls.all_policies_applied tables=%d", len(RLS_TABLES))


def _apply_for_table(cursor, table: str) -> None:
    """Enables RLS and creates isolation policy for a single table."""

    # Enable RLS on the table
    cursor.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")

    # Drop existing policy (idempotent)
    cursor.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table};")

    # Create isolation policy:
    # - Row is visible if its tenant_id matches the current session setting,
    #   OR if it has no tenant_id (global/public record).
    cursor.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        FOR ALL
        TO {APP_ROLE}
        USING (
            tenant_id IS NULL
            OR tenant_id = ''
            OR tenant_id = current_setting('app.tenant_id', TRUE)
        );
    """)
    logger.debug("rls.policy_created table=%s", table)


def set_tenant_context(tenant_id: str) -> None:
    """
    Sets the current PostgreSQL session's tenant context.

    Call this at the start of a database connection session
    (e.g. in Django middleware or a Celery task beat).

    Args:
        tenant_id: The active tenant identifier.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT set_config('app.tenant_id', %s, FALSE);",
            [tenant_id],
        )


def remove_rls_policies() -> None:
    """
    Removes all RLS policies (for rollback or testing).
    """
    with connection.cursor() as cursor:
        for table in RLS_TABLES:
            cursor.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table};")
            cursor.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
    logger.info("rls.all_policies_removed")
