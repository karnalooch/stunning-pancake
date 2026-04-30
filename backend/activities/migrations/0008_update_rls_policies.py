from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('activities', '0007_enable_rls_poi_vouchers'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                -- 0. Ensure the application role exists (needed for RLS policy TO clauses)
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sport_app') THEN
                        CREATE ROLE sport_app;
                    END IF;
                END
                $$;

                -- 1. Direct RLS: activities_activity
                ALTER TABLE activities_activity ENABLE ROW LEVEL SECURITY;
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

                -- 2. Direct RLS: activities_poi
                ALTER TABLE activities_poi ENABLE ROW LEVEL SECURITY;
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

                -- 3. Linked RLS: activities_voucher
                ALTER TABLE activities_voucher ENABLE ROW LEVEL SECURITY;
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
            ''',
            reverse_sql='''
                DROP POLICY IF EXISTS tenant_isolation ON activities_voucher;
                DROP POLICY IF EXISTS tenant_isolation ON activities_poi;
                DROP POLICY IF EXISTS tenant_isolation ON activities_activity;
            '''
        ),
    ]
