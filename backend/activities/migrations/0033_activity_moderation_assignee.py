import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("activities", "0032_poi_sponsor_moderation_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="activity",
            name="moderation_assignee",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assigned_moderation_activities",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
