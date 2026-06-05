from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0016_auditlog_details"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenant",
            name="map_theme",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Live Map cluster/hub palette overrides (white-label)",
            ),
        ),
    ]
