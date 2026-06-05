from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0015_alter_role_slug"),
    ]

    operations = [
        migrations.AddField(
            model_name="auditlog",
            name="details",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
