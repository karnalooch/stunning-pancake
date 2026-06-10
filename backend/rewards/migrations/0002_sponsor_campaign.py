from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("rewards", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SponsorCampaign",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("DRAFT", "Draft"),
                            ("ACTIVE", "Active"),
                            ("PAUSED", "Paused"),
                            ("ENDED", "Ended"),
                        ],
                        default="DRAFT",
                        max_length=20,
                    ),
                ),
                ("start_date", models.DateTimeField(blank=True, null=True)),
                ("end_date", models.DateTimeField(blank=True, null=True)),
                ("budget_points", models.PositiveIntegerField(default=0, help_text="0 = unlimited")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "sponsor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="campaigns",
                        to="rewards.sponsor",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
