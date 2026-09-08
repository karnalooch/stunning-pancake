import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0018_user_mfa_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserDataExport",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("job_id", models.CharField(db_index=True, max_length=32, unique=True)),
                ("status", models.CharField(default="pending", max_length=20)),
                ("storage_uri", models.CharField(blank=True, default="", max_length=512)),
                ("download_key", models.CharField(blank=True, default="", max_length=512)),
                ("activity_count", models.IntegerField(default=0)),
                ("expires_at", models.DateTimeField()),
                ("error", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="data_exports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
