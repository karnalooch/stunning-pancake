from django.db import migrations


FORWARD_SQL = r"""
CREATE OR REPLACE FUNCTION users_auditlog_append_only_guard()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'users_auditlog is append-only: DELETE is forbidden';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Audit payload is immutable.  The only permitted update is FK
        -- nullification caused by deleting an associated User through the
        -- existing ON DELETE SET NULL contract.  This preserves account
        -- deletion while preventing audit history from being rewritten.
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
           OR NEW.action IS DISTINCT FROM OLD.action
           OR NEW.details IS DISTINCT FROM OLD.details
           OR NEW.ip_address IS DISTINCT FROM OLD.ip_address
           OR NEW.status_code IS DISTINCT FROM OLD.status_code
           OR NEW.timestamp IS DISTINCT FROM OLD.timestamp
           OR (
                NEW.impersonator_id IS DISTINCT FROM OLD.impersonator_id
                AND NOT (
                    OLD.impersonator_id IS NOT NULL
                    AND NEW.impersonator_id IS NULL
                )
           )
           OR (
                NEW.target_user_id IS DISTINCT FROM OLD.target_user_id
                AND NOT (
                    OLD.target_user_id IS NOT NULL
                    AND NEW.target_user_id IS NULL
                )
           )
        THEN
            RAISE EXCEPTION 'users_auditlog is append-only: UPDATE is forbidden';
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_auditlog_append_only_guard ON users_auditlog;
CREATE TRIGGER users_auditlog_append_only_guard
BEFORE UPDATE OR DELETE ON users_auditlog
FOR EACH ROW EXECUTE FUNCTION users_auditlog_append_only_guard();
"""

REVERSE_SQL = r"""
DROP TRIGGER IF EXISTS users_auditlog_append_only_guard ON users_auditlog;
DROP FUNCTION IF EXISTS users_auditlog_append_only_guard();
"""


def install_guard(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(FORWARD_SQL)


def remove_guard(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(REVERSE_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0022_canonical_fourvelo_rls"),
    ]

    operations = [
        migrations.RunPython(install_guard, remove_guard),
    ]
