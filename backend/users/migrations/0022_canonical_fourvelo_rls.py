"""T11 - canonical PostgreSQL RLS policies for users tables.

Drops the legacy ``department_tenant_isolation`` and
``userdepartment_tenant_isolation`` policies on ``users_department`` and
``users_userdepartment`` that were installed by migration ``0014`` and
relied on ``app.user_id`` / ``users_user`` lookups, then installs a single
canonical policy set bound to ``PUBLIC`` and the ``app.tenant_id`` /
``app.is_global_owner`` GUCs.

Exact pre-T11 state (per migration ``0014_department_rls``):

* ``users_department``, ``users_userdepartment`` both have
  ``ENABLE ROW LEVEL SECURITY`` (no ``FORCE``).
* Policy ``department_tenant_isolation`` on ``users_department`` with no
  explicit ``TO`` (default ``TO PUBLIC``):

    USING (
        EXISTS (SELECT 1 FROM users_user WHERE id = current_setting('app.user_id')::int
                AND role = 'GLOBAL_OWNER')
        OR
        tenant_id = current_setting('app.tenant_id')::uuid
    )

* Policy ``userdepartment_tenant_isolation`` on ``users_userdepartment``
  with the same GLOBAL_OWNER bypass via ``app.user_id``.

The reverse of T11 must restore that exact state. The legacy
``app.user_id`` GUC and ``users_user`` lookup are preserved because they
are part of the historical ``pg_policy`` expressions; broadening them
would be a security regression. T11's forward never depends on
``app.user_id`` being set.

Contract (forward):

* ``FOR ALL`` to ``PUBLIC`` (the runtime connection role).
* Explicit ``USING`` and ``WITH CHECK`` on every policy.
* Tenant resolution:
    * direct: ``tenant_id`` on ``users_department``;
    * indirect: ``users_userdepartment.department_id`` -> ``users_department.tenant_id``.
* Fail-closed: missing/empty ``app.tenant_id`` -> no rows visible, no writes
  allowed; rows with ``tenant_id IS NULL`` are NEVER visible to
  non-GLOBAL_OWNER; cross-tenant INSERT/UPDATE/DELETE blocked by WITH CHECK
  + USING; ``app.is_global_owner`` must equal the literal string
  ``'true'`` to grant global access.
* No recursion: linked-table policies do not depend on another table whose
  policy references this one.
* No role lifecycle: this migration never ``CREATE ROLE``, ``GRANT TO``,
  ``REVOKE FROM`` or ``DROP ROLE`` any PostgreSQL role.
"""

from django.db import migrations

APP_GLOBAL_OWNER_GUC = "app.is_global_owner"
APP_TENANT_GUC = "app.tenant_id"


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0021_userpushtoken"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                """
                -- 1. users_department - direct tenant_id.
                ALTER TABLE users_department ENABLE ROW LEVEL SECURITY;
                ALTER TABLE users_department FORCE ROW LEVEL SECURITY;

                DROP POLICY IF EXISTS department_tenant_isolation      ON users_department;
                DROP POLICY IF EXISTS tenant_isolation_policy          ON users_department;
                DROP POLICY IF EXISTS tenant_isolation                 ON users_department;
                DROP POLICY IF EXISTS fourvelo_tenant_isolation        ON users_department;

                CREATE POLICY fourvelo_tenant_isolation ON users_department
                    FOR ALL
                    TO PUBLIC
                    USING (
                        (
                            current_setting('app.is_global_owner', true) = 'true'
                        )
                        OR (
                            NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
                            AND tenant_id IS NOT NULL
                            AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                        )
                    )
                    WITH CHECK (
                        (
                            current_setting('app.is_global_owner', true) = 'true'
                        )
                        OR (
                            NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
                            AND tenant_id IS NOT NULL
                            AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                        )
                    );

                -- 2. users_userdepartment - tenant via users_department.
                ALTER TABLE users_userdepartment ENABLE ROW LEVEL SECURITY;
                ALTER TABLE users_userdepartment FORCE ROW LEVEL SECURITY;

                DROP POLICY IF EXISTS userdepartment_tenant_isolation ON users_userdepartment;
                DROP POLICY IF EXISTS tenant_isolation_policy         ON users_userdepartment;
                DROP POLICY IF EXISTS tenant_isolation                ON users_userdepartment;
                DROP POLICY IF EXISTS fourvelo_tenant_isolation       ON users_userdepartment;

                CREATE POLICY fourvelo_tenant_isolation ON users_userdepartment
                    FOR ALL
                    TO PUBLIC
                    USING (
                        (
                            current_setting('app.is_global_owner', true) = 'true'
                        )
                        OR (
                            NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
                            AND EXISTS (
                                SELECT 1 FROM users_department d
                                WHERE d.id = users_userdepartment.department_id
                                  AND d.tenant_id IS NOT NULL
                                  AND d.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                            )
                        )
                    )
                    WITH CHECK (
                        (
                            current_setting('app.is_global_owner', true) = 'true'
                        )
                        OR (
                            NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
                            AND EXISTS (
                                SELECT 1 FROM users_department d
                                WHERE d.id = users_userdepartment.department_id
                                  AND d.tenant_id IS NOT NULL
                                  AND d.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                            )
                        )
                    );
                """
            ),
            reverse_sql=(
                """
                -- Restore the exact pre-T11 state on the users side
                -- (post-migration ``0014_department_rls``):
                -- * DROP the canonical ``fourvelo_tenant_isolation`` policy;
                -- * keep ENABLE ROW LEVEL SECURITY;
                -- * remove FORCE ROW LEVEL SECURITY (FORCE was introduced by T11);
                -- * recreate the historical ``department_tenant_isolation`` and
                --   ``userdepartment_tenant_isolation`` policies verbatim from
                --   migration ``0014``. They have no explicit ``TO`` clause, so
                --   they default to ``TO PUBLIC`` - matching the original.
                --   They reference the legacy ``app.user_id`` GUC and the
                --   ``users_user`` table for the GLOBAL_OWNER bypass; those
                --   references are preserved because they are part of the
                --   historical ``pg_policy`` expressions.
                DROP POLICY IF EXISTS fourvelo_tenant_isolation ON users_userdepartment;
                DROP POLICY IF EXISTS fourvelo_tenant_isolation ON users_department;

                DROP POLICY IF EXISTS department_tenant_isolation ON users_department;
                DROP POLICY IF EXISTS tenant_isolation_policy      ON users_department;
                DROP POLICY IF EXISTS tenant_isolation             ON users_department;
                CREATE POLICY department_tenant_isolation ON users_department
                    USING (
                        EXISTS (SELECT 1 FROM users_user WHERE id = current_setting('app.user_id')::int AND role = 'GLOBAL_OWNER')
                        OR
                        tenant_id = current_setting('app.tenant_id')::uuid
                    );

                DROP POLICY IF EXISTS userdepartment_tenant_isolation ON users_userdepartment;
                DROP POLICY IF EXISTS tenant_isolation_policy         ON users_userdepartment;
                DROP POLICY IF EXISTS tenant_isolation                ON users_userdepartment;
                CREATE POLICY userdepartment_tenant_isolation ON users_userdepartment
                    USING (
                        EXISTS (SELECT 1 FROM users_user WHERE id = current_setting('app.user_id')::int AND role = 'GLOBAL_OWNER')
                        OR
                        department_id IN (SELECT id FROM users_department WHERE tenant_id = current_setting('app.tenant_id')::uuid)
                    );

                -- Remove FORCE (it was added by T11). Keep ENABLE.
                ALTER TABLE users_department     NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE users_userdepartment NO FORCE ROW LEVEL SECURITY;
                """
            ),
        ),
    ]
