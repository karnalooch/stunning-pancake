from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("activities", "0016_live_map_alert_webhook"),
    ]

    operations = [
        migrations.AddField(
            model_name="livemapalertwebhook",
            name="delivery_log",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Last N delivery attempts (newest first), max 10",
            ),
        ),
    ]
