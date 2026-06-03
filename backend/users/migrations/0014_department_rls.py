"""
Migration: Add RLS policies for Department tables.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0013_add_departments_to_user"),
    ]

    operations = [
        migrations.RunSQL(
            """
            -- Department RLS: users can only see departments in their tenant
            ALTER TABLE users_department ENABLE ROW LEVEL SECURITY;

            CREATE POLICY department_tenant_isolation ON users_department
                USING (
                    -- Global owners see everything
                    EXISTS (SELECT 1 FROM users_user WHERE id = current_setting('app.user_id')::int AND role = 'GLOBAL_OWNER')
                    OR
                    -- Others see only their tenant's departments
                    tenant_id = current_setting('app.tenant_id')::uuid
                );

            -- UserDepartment RLS: users can only see assignments in their tenant
            ALTER TABLE users_userdepartment ENABLE ROW LEVEL SECURITY;

            CREATE POLICY userdepartment_tenant_isolation ON users_userdepartment
                USING (
                    EXISTS (SELECT 1 FROM users_user WHERE id = current_setting('app.user_id')::int AND role = 'GLOBAL_OWNER')
                    OR
                    department_id IN (SELECT id FROM users_department WHERE tenant_id = current_setting('app.tenant_id')::uuid)
                );
        """,
            reverse_sql="""
            DROP POLICY IF EXISTS userdepartment_tenant_isolation ON users_userdepartment;
            DROP POLICY IF EXISTS department_tenant_isolation ON users_department;
            ALTER TABLE users_userdepartment DISABLE ROW LEVEL SECURITY;
            ALTER TABLE users_department DISABLE ROW LEVEL SECURITY;
        """,
        ),
    ]
