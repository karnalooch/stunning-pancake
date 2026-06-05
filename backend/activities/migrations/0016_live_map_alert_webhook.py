import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0016_auditlog_details"),
        ("activities", "0015_live_position_events"),
    ]

    operations = [
        migrations.CreateModel(
            name="LiveMapAlertWebhook",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("url", models.URLField(max_length=500)),
                ("secret", models.CharField(help_text="HMAC signing secret", max_length=128)),
                (
                    "events",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Subscribed event names, e.g. ['viewport_capped', 'sync_stale']",
                    ),
                ),
                ("enabled", models.BooleanField(default=True)),
                ("last_delivery_at", models.DateTimeField(blank=True, null=True)),
                ("failure_count", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="live_map_webhooks",
                        to="users.tenant",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
