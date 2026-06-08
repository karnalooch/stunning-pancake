from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("activities", "0017_livemapwebhook_delivery_log"),
    ]

    operations = [
        migrations.AddField(
            model_name="activity",
            name="gpx_generated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="activity",
            name="gpx_sha256",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="activity",
            name="gpx_storage_key",
            field=models.CharField(blank=True, default="", max_length=512),
        ),
    ]
