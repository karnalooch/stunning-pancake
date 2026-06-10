# Generated for monorepo overhaul: POI.sponsor scope + Activity moderation audit fields

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rewards", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("activities", "0031_activity_route_fingerprint"),
    ]

    operations = [
        migrations.AddField(
            model_name="activity",
            name="moderated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="activity",
            name="moderated_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="moderated_activities",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="activity",
            name="rejection_reason",
            field=models.CharField(
                blank=True,
                choices=[
                    ("GPS_SPOOF", "GPS spoofing suspected"),
                    ("DISTANCE_MISMATCH", "Distance mismatch"),
                    ("DUPLICATE", "Duplicate activity"),
                    ("OTHER", "Other"),
                ],
                default="",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="activity",
            name="rejection_notes",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="poi",
            name="sponsor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="pois",
                to="rewards.sponsor",
            ),
        ),
    ]
