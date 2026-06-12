# Generated manually - converts AuditLog integer fields to ForeignKey constraints
# while preserving existing data.
#
# Strategy:
#   1. Rename old IntegerField columns (impersonator_id → impersonator_old_id,
#      target_user_id → target_user_old_id) to free up the column names.
#   2. Add new ForeignKey columns (impersonator, target_user) which Django
#      creates as DB columns impersonator_id, target_user_id.
#   3. Copy data from old columns to new FK columns.
#   4. Remove old columns.
#
# Also adds tenant_id for multi-tenant filtering.

import django.db.models.deletion
from django.db import migrations, models


def copy_integer_ids_to_fk(apps, schema_editor):
    AuditLog = apps.get_model("users", "AuditLog")
    for log in AuditLog.objects.all():
        log.impersonator_id = log.impersonator_old_id
        log.target_user_id = log.target_user_old_id
        log.save(update_fields=["impersonator_id", "target_user_id"])


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0006_auditlog"),
    ]

    operations = [
        # Step 1: Rename old IntegerField columns to temporary names
        migrations.RenameField(
            model_name="auditlog",
            old_name="impersonator_id",
            new_name="impersonator_old_id",
        ),
        migrations.RenameField(
            model_name="auditlog",
            old_name="target_user_id",
            new_name="target_user_old_id",
        ),
        # Step 2: Add new ForeignKey columns (DB columns: impersonator_id, target_user_id)
        migrations.AddField(
            model_name="auditlog",
            name="impersonator",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="audit_logs_as_impersonator",
                to="users.User",
                help_text="The GLOBAL_OWNER who initiated the impersonation (or the admin who performed the action)",
            ),
        ),
        migrations.AddField(
            model_name="auditlog",
            name="target_user",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="audit_logs_as_target",
                to="users.User",
                help_text="The user who was impersonated (or the admin themself for non-impersonated actions)",
            ),
        ),
        # Step 3: Copy data from old integer columns to new FK columns
        migrations.RunPython(
            copy_integer_ids_to_fk,
            reverse_code=migrations.RunPython.noop,
        ),
        # Step 4: Remove old integer columns
        migrations.RemoveField(
            model_name="auditlog",
            name="impersonator_old_id",
        ),
        migrations.RemoveField(
            model_name="auditlog",
            name="target_user_old_id",
        ),
        # Step 5: Add tenant_id for multi-tenant filtering
        migrations.AddField(
            model_name="auditlog",
            name="tenant_id",
            field=models.CharField(
                max_length=50,
                null=True,
                blank=True,
                help_text="Tenant context at the time of the action (denormalized for multi-tenant filtering)",
            ),
        ),
        # Step 6: Update model options
        migrations.AlterModelOptions(
            name="auditlog",
            options={
                "ordering": ["-timestamp"],
                "verbose_name": "Audit Log",
                "verbose_name_plural": "Audit Logs",
            },
        ),
    ]
