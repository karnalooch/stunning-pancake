import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0005_tenant_delete_tenantprofile_remove_user_tenant_id_and_more"),
        ("core", "0001_feature_flags"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlatformNotice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "severity",
                    models.CharField(
                        choices=[("info", "Info"), ("warning", "Warning"), ("critical", "Critical")],
                        default="info",
                        max_length=16,
                    ),
                ),
                ("title_pl", models.CharField(max_length=200)),
                ("title_en", models.CharField(max_length=200)),
                ("body_pl", models.TextField()),
                ("body_en", models.TextField()),
                ("starts_at", models.DateTimeField()),
                ("ends_at", models.DateTimeField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("dismissible", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "tenant",
                    models.ForeignKey(
                        blank=True,
                        help_text="Null = global notice for all tenants",
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="platform_notices",
                        to="users.tenant",
                    ),
                ),
            ],
            options={
                "ordering": ["-starts_at"],
                "indexes": [
                    models.Index(fields=["is_active", "starts_at"], name="core_platfo_is_acti_idx"),
                    models.Index(fields=["tenant", "is_active"], name="core_platfo_tenant__idx"),
                ],
            },
        ),
    ]
