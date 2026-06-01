# Generated manually for leaderboard hardening

from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0011_beta_feedback"),
    ]

    operations = [
        migrations.AddField(
            model_name="activity",
            name="external_source",
            field=models.CharField(
                blank=True,
                choices=[
                    ("STRAVA", "Strava"),
                    ("GARMIN", "Garmin"),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="activity",
            name="external_id",
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AddConstraint(
            model_name="activity",
            constraint=models.UniqueConstraint(
                condition=Q(external_id__isnull=False) & ~Q(external_id=""),
                fields=("user", "external_source", "external_id"),
                name="activities_activity_user_external_unique",
            ),
        ),
    ]
