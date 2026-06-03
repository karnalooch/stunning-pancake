from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("activities", "0012_activity_external_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="DiskAuditEvent",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "event_type",
                    models.CharField(
                        choices=[
                            ("ok", "OK"),
                            ("warn", "Warning"),
                            ("pause_sim", "Pause simulation"),
                            ("block_writes", "Block sim writes"),
                            ("cleared", "Safeguards cleared"),
                            ("retention_cleanup", "Retention cleanup"),
                            ("preflight", "Preflight"),
                            ("manual", "Manual"),
                        ],
                        db_index=True,
                        max_length=32,
                    ),
                ),
                ("used_gb", models.FloatField(blank=True, null=True)),
                ("budget_gb", models.FloatField(blank=True, null=True)),
                ("pct", models.FloatField(blank=True, help_text="used_gb / budget_gb", null=True)),
                ("action_taken", models.CharField(max_length=500)),
                (
                    "source",
                    models.CharField(
                        choices=[
                            ("cron", "Celery beat"),
                            ("manual", "Management command"),
                            ("simulator", "Simulator task"),
                            ("preflight", "Preflight / admin"),
                            ("api", "Admin API"),
                        ],
                        default="cron",
                        max_length=64,
                    ),
                ),
            ],
            options={
                "verbose_name": "Disk audit event",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["-created_at", "event_type"], name="activities__created_8a1f2d_idx"
                    ),
                ],
            },
        ),
    ]
