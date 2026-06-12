# Generated manually - adds POI.category field and WearableIntegration model (Milestone 4)

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("activities", "0008_update_rls_policies"),
    ]

    operations = [
        migrations.AddField(
            model_name="poi",
            name="category",
            field=models.CharField(
                choices=[
                    ("COFFEE", "Coffee Shop"),
                    ("SHOP", "Retail Store"),
                    ("BIKE", "Bike Shop/Service"),
                    ("OTHER", "Other"),
                ],
                default="OTHER",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="WearableIntegration",
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
                (
                    "service",
                    models.CharField(
                        choices=[
                            ("STRAVA", "Strava"),
                            ("GARMIN", "Garmin"),
                            ("APPLE", "Apple HealthKit"),
                        ],
                        max_length=20,
                    ),
                ),
                ("access_token", models.TextField()),
                ("refresh_token", models.TextField(blank=True, null=True)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("external_id", models.CharField(blank=True, max_length=200, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("last_sync", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="wearables",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "unique_together": {("user", "service")},
            },
        ),
    ]
