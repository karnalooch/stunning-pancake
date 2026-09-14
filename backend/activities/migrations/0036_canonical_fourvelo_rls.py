"""T11 - canonical PostgreSQL RLS policies for activities tables.

Drops the legacy ``tenant_isolation`` policies on
``activities_activity``, ``activities_poi`` and ``activities_voucher`` that
were installed by migrations ``0006``, ``0007`` and ``0008`` and were
bound to the deprecated ``sport_app`` role, then installs a single
canonical policy set bound to ``PUBLIC`` and the
``app.tenant_id`` / ``app.is_global_owner`` GUCs.

Exact pre-T11 state (per migration ``0008_update_rls_policies``):

* ``activities_activity``, ``activities_poi``, ``activities_voucher`` all
  have ``ENABLE ROW LEVEL SECURITY`` (no ``FORCE``).
* Policy ``tenant_isolation`` bound to ``TO sport_app`` with:

  - ``activities_activity`` / ``activities_poi``:
    ``tenant_id IS NULL OR (app.tenant_id set AND tenant_id match)``
  - ``activities_voucher``:
    ``app.tenant_id empty OR EXISTS on activities_poi matching tenant``.

The reverse of T11 must restore that exact state so a rollback leaves the
schema indistinguishable from a database that never applied T11. The
``TO sport_app`` role reference is preserved because the historical policy
used it - changing it would broaden access to every role (including the
runtime owner) instead of restricting it to the legacy ``sport_app`` role.
T11's forward never depends on ``sport_app`` existing.

Contract (forward):

* ``FOR ALL`` to ``PUBLIC`` (the runtime connection role).
* Explicit ``USING`` and ``WITH CHECK`` on every policy.
* Tenant resolution:
    * direct: ``tenant_id`` column on ``activities_activity`` / ``activities_poi``;
    * indirect: ``activities_voucher.poi_id`` -> ``activities_poi.tenant_id``.
* Fail-closed:
    * missing or empty ``app.tenant_id`` -> no rows visible, no writes allowed;
    * rows with ``tenant_id IS NULL`` are NEVER visible to non-GLOBAL_OWNER;
    * cross-tenant INSERT / UPDATE / DELETE blocked by WITH CHECK + USING;
    * ``app.is_global_owner`` must equal the canonical literal ``'true'``
      to grant global access.
* No recursion: linked-table policies do not themselves touch a table whose
  policy depends on this one.
* No role lifecycle: this migration never ``CREATE ROLE``, ``GRANT TO``,
  ``REVOKE FROM`` or ``DROP ROLE`` any PostgreSQL role.
"""

from django.db import migrations

APP_GLOBAL_OWNER_GUC = "app.is_global_owner"
APP_TENANT_GUC = "app.tenant_id"


class Migration(migrations.Migration):
    dependencies = [
        ("activities", "0035_garmin_simulator_credential"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                """
                -- 1. activities_activity - direct tenant_id.
                ALTER TABLE activities_activity ENABLE ROW LEVEL SECURITY;
                ALTER TABLE activities_activity FORCE ROW LEVEL SECURITY;

                DROP POLICY IF EXISTS tenant_isolation_policy   ON activities_activity;
                DROP POLICY IF EXISTS poi_tenant_isolation_policy ON activities_activity;
                DROP POLICY IF EXISTS tenant_isolation          ON activities_activity;
                DROP POLICY IF EXISTS fourvelo_tenant_isolation ON activities_activity;

                CREATE POLICY fourvelo_tenant_isolation ON activities_activity
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

                -- 2. activities_poi - direct tenant_id.
                ALTER TABLE activities_poi ENABLE ROW LEVEL SECURITY;
                ALTER TABLE activities_poi FORCE ROW LEVEL SECURITY;

                DROP POLICY IF EXISTS poi_tenant_isolation_policy   ON activities_poi;
                DROP POLICY IF EXISTS tenant_isolation_policy       ON activities_poi;
                DROP POLICY IF EXISTS tenant_isolation              ON activities_poi;
                DROP POLICY IF EXISTS fourvelo_tenant_isolation     ON activities_poi;

                CREATE POLICY fourvelo_tenant_isolation ON activities_poi
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

                -- 3. activities_voucher - tenant via activities_poi.
                --    No recursion: we read activities_poi, whose policy is the
                --    direct one above and does not touch activities_voucher.
                ALTER TABLE activities_voucher ENABLE ROW LEVEL SECURITY;
                ALTER TABLE activities_voucher FORCE ROW LEVEL SECURITY;

                DROP POLICY IF EXISTS voucher_tenant_isolation_policy   ON activities_voucher;
                DROP POLICY IF EXISTS tenant_isolation_policy          ON activities_voucher;
                DROP POLICY IF EXISTS tenant_isolation                 ON activities_voucher;
                DROP POLICY IF EXISTS fourvelo_tenant_isolation        ON activities_voucher;

                CREATE POLICY fourvelo_tenant_isolation ON activities_voucher
                    FOR ALL
                    TO PUBLIC
                    USING (
                        (
                            current_setting('app.is_global_owner', true) = 'true'
                        )
                        OR (
                            NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
                            AND EXISTS (
                                SELECT 1 FROM activities_poi p
                                WHERE p.id = activities_voucher.poi_id
                                  AND p.tenant_id IS NOT NULL
                                  AND p.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
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
                                SELECT 1 FROM activities_poi p
                                WHERE p.id = activities_voucher.poi_id
                                  AND p.tenant_id IS NOT NULL
                                  AND p.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                            )
                        )
                    );
                """
            ),
            reverse_sql=(
                """
                -- Restore the exact pre-T11 state on the activities side
                -- (post-migration ``0008_update_rls_policies``):
                -- * DROP the canonical ``fourvelo_tenant_isolation`` policy;
                -- * keep ENABLE ROW LEVEL SECURITY;
                -- * remove FORCE ROW LEVEL SECURITY (FORCE was introduced by T11);
                -- * recreate the historical ``tenant_isolation`` policy bound to
                --   the legacy ``TO sport_app`` role, exactly as ``0008`` did.
                -- The legacy role name is permitted here because it is required
                -- to recreate the historical policy verbatim; T11's forward
                -- does not depend on this role existing.
                DROP POLICY IF EXISTS fourvelo_tenant_isolation ON activities_voucher;
                DROP POLICY IF EXISTS fourvelo_tenant_isolation ON activities_poi;
                DROP POLICY IF EXISTS fourvelo_tenant_isolation ON activities_activity;

                DROP POLICY IF EXISTS tenant_isolation ON activities_activity;
                DROP POLICY IF EXISTS tenant_isolation_policy ON activities_activity;
                DROP POLICY IF EXISTS poi_tenant_isolation_policy ON activities_activity;
                CREATE POLICY tenant_isolation ON activities_activity
                    FOR ALL
                    TO sport_app
                    USING (
                        tenant_id IS NULL
                        OR (
                            current_setting('app.tenant_id', TRUE) != ''
                            AND tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::uuid
                        )
                    );

                DROP POLICY IF EXISTS tenant_isolation ON activities_poi;
                DROP POLICY IF EXISTS tenant_isolation_policy ON activities_poi;
                DROP POLICY IF EXISTS poi_tenant_isolation_policy ON activities_poi;
                CREATE POLICY tenant_isolation ON activities_poi
                    FOR ALL
                    TO sport_app
                    USING (
                        tenant_id IS NULL
                        OR (
                            current_setting('app.tenant_id', TRUE) != ''
                            AND tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::uuid
                        )
                    );

                DROP POLICY IF EXISTS tenant_isolation ON activities_voucher;
                DROP POLICY IF EXISTS voucher_tenant_isolation_policy ON activities_voucher;
                CREATE POLICY tenant_isolation ON activities_voucher
                    FOR ALL
                    TO sport_app
                    USING (
                        current_setting('app.tenant_id', TRUE) = ''
                        OR EXISTS (
                            SELECT 1 FROM activities_poi p
                            WHERE p.id = activities_voucher.poi_id
                            AND p.tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::uuid
                        )
                    );

                -- Remove FORCE (it was added by T11). Keep ENABLE.
                ALTER TABLE activities_activity NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE activities_poi     NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE activities_voucher NO FORCE ROW LEVEL SECURITY;
                """
            ),
        ),
    ]
