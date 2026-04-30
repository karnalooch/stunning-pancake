import logging
from django.db import connection

logger = logging.getLogger(__name__)

# Tables that have a direct tenant_id column
DIRECT_RLS_TABLES = [
    "activities_activity",
    "activities_poi",
]

# Tables that require a join (e.g. via POI)
LINKED_RLS_TABLES = {
    "activities_voucher": "poi_id IN (SELECT id FROM activities_poi WHERE tenant_id = %s)"
}

APP_ROLE = "sport_app"

def ensure_app_role():
    """Create the application role if it doesn't exist (used for RLS policies)."""
    with connection.cursor() as cursor:
        cursor.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '{APP_ROLE}') THEN
                    CREATE ROLE {APP_ROLE};
                END IF;
            END
            $$;
        """)

def apply_rls_policies():
    with connection.cursor() as cursor:
        # Ensure the role exists before creating policies that reference it
        ensure_app_role()

        # 1. Direct RLS
        for table in DIRECT_RLS_TABLES:
            logger.info(f"Applying RLS to {table}")
            cursor.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
            cursor.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table};")
            # Drop old legacy policies if they exist
            cursor.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table};")
            cursor.execute(f"DROP POLICY IF EXISTS poi_tenant_isolation_policy ON {table};")
            
            cursor.execute(f"""
                CREATE POLICY tenant_isolation ON {table}
                FOR ALL
                TO {APP_ROLE}
                USING (
                    tenant_id IS NULL
                    OR (
                        current_setting('app.tenant_id', TRUE) != '' 
                        AND tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::uuid
                    )
                );
            """)

        # 2. Linked RLS (Vouchers)
        for table, condition_template in LINKED_RLS_TABLES.items():
            logger.info(f"Applying Linked RLS to {table}")
            cursor.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
            cursor.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table};")
            cursor.execute(f"DROP POLICY IF EXISTS voucher_tenant_isolation_policy ON {table};")
            
            # Note: For linked tables, we check the tenant_id of the parent record
            cursor.execute(f"""
                CREATE POLICY tenant_isolation ON {table}
                FOR ALL
                TO {APP_ROLE}
                USING (
                    current_setting('app.tenant_id', TRUE) = ''
                    OR EXISTS (
                        SELECT 1 FROM activities_poi p 
                        WHERE p.id = {table}.poi_id 
                        AND p.tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::uuid
                    )
                );
            """)

    logger.info("RLS policies applied.")

def set_tenant_context(tenant_id: str):
    with connection.cursor() as cursor:
        cursor.execute("SELECT set_config('app.tenant_id', %s, FALSE);", [str(tenant_id)])

def remove_rls_policies():
    with connection.cursor() as cursor:
        all_tables = DIRECT_RLS_TABLES + list(LINKED_RLS_TABLES.keys())
        for table in all_tables:
            cursor.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table};")
            cursor.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
