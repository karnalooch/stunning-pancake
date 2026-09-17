from django.db import migrations, models


def backfill_audit_identity_snapshots(apps, schema_editor):
    AuditLog = apps.get_model("users", "AuditLog")
    for log in AuditLog.objects.select_related("impersonator", "target_user").iterator(chunk_size=1000):
        updates = {}
        if log.impersonator_id is not None:
            updates["impersonator_id_snapshot"] = log.impersonator_id
            if log.impersonator is not None:
                updates["impersonator_username_snapshot"] = log.impersonator.username
        if log.target_user_id is not None:
            updates["target_user_id_snapshot"] = log.target_user_id
            if log.target_user is not None:
                updates["target_user_username_snapshot"] = log.target_user.username
        if updates:
            AuditLog.objects.filter(pk=log.pk).update(**updates)


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0022_canonical_fourvelo_rls"),
    ]

    operations = [
        migrations.AddField(
            model_name="auditlog",
            name="impersonator_id_snapshot",
            field=models.BigIntegerField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="auditlog",
            name="target_user_id_snapshot",
            field=models.BigIntegerField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="auditlog",
            name="impersonator_username_snapshot",
            field=models.CharField(blank=True, editable=False, max_length=150, null=True),
        ),
        migrations.AddField(
            model_name="auditlog",
            name="target_user_username_snapshot",
            field=models.CharField(blank=True, editable=False, max_length=150, null=True),
        ),
        migrations.RunPython(backfill_audit_identity_snapshots, migrations.RunPython.noop),
    ]
