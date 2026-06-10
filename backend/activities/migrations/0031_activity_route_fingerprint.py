from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("activities", "0030_activity_gpx_archive_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="activity",
            name="route_fingerprint",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="activity",
            name="gpx_forensics_flags",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
