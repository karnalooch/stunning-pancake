from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('activities', '0006_enable_rls'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                ALTER TABLE activities_poi ENABLE ROW LEVEL SECURITY;
                CREATE POLICY poi_tenant_isolation_policy ON activities_poi
                USING (tenant_id = current_setting('sport.current_tenant_id', true)::uuid);

                ALTER TABLE activities_voucher ENABLE ROW LEVEL SECURITY;
                CREATE POLICY voucher_tenant_isolation_policy ON activities_voucher
                USING (
                    EXISTS (
                        SELECT 1 FROM activities_poi p
                        WHERE p.id = activities_voucher.poi_id
                        AND p.tenant_id = current_setting('sport.current_tenant_id', true)::uuid
                    )
                );
            ''',
            reverse_sql='''
                DROP POLICY IF EXISTS voucher_tenant_isolation_policy ON activities_voucher;
                ALTER TABLE activities_voucher DISABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS poi_tenant_isolation_policy ON activities_poi;
                ALTER TABLE activities_poi DISABLE ROW LEVEL SECURITY;
            '''
        ),
    ]
