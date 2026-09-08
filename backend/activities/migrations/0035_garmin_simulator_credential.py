from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("activities", "0034_tier0_three_disciplines"),
    ]

    operations = [
        migrations.CreateModel(
            name="GarminSimulatorCredential",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("garmin_email", models.TextField()),
                ("garmin_password", models.TextField()),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=models.CASCADE,
                        related_name="garmin_sim_credential",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="garminsimulatorcredential",
            index=models.Index(
                fields=["is_active", "created_at"],
                name="gsc_active_created_idx",
            ),
        ),
    ]
