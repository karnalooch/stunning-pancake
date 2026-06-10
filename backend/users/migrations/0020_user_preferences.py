from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0019_userdataexport"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="preferences",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="User UI preferences: notifications, language, dashboard widgets, etc.",
            ),
        ),
    ]
