# Generated manually — creates BetaFeedback model for RC v0.2 tester feedback

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("activities", "0010_encrypt_tokens"),
    ]

    operations = [
        migrations.CreateModel(
            name="BetaFeedback",
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
                    "category",
                    models.CharField(
                        choices=[
                            ("BUG", "Bug Report"),
                            ("FEATURE", "Feature Request"),
                            ("UX", "UX / Design"),
                            ("PERF", "Performance"),
                            ("OTHER", "Other"),
                        ],
                        default="OTHER",
                        max_length=30,
                    ),
                ),
                ("message", models.TextField()),
                (
                    "screen",
                    models.CharField(
                        blank=True,
                        help_text="Which screen the feedback is about",
                        max_length=100,
                    ),
                ),
                (
                    "severity",
                    models.IntegerField(
                        choices=[
                            (1, "Critical"),
                            (2, "High"),
                            (3, "Medium"),
                            (4, "Low"),
                            (5, "Cosmetic"),
                        ],
                        default=3,
                    ),
                ),
                ("resolved", models.BooleanField(default=False)),
                ("admin_notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="beta_feedback",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "beta_feedback",
                "ordering": ["-created_at"],
            },
        ),
    ]
