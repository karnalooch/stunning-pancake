from django.db import migrations, models


def wheelchair_to_walk(apps, schema_editor):
    Activity = apps.get_model("activities", "Activity")
    Activity.objects.filter(type="WHEELCHAIR").update(type="WALK")


class Migration(migrations.Migration):
    dependencies = [
        ("activities", "0033_activity_moderation_assignee"),
    ]

    operations = [
        migrations.RunPython(wheelchair_to_walk, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="activity",
            name="type",
            field=models.CharField(
                choices=[
                    ("RUN", "Running"),
                    ("BIKE", "Cycling"),
                    ("WALK", "Nordic Walking"),
                ],
                max_length=20,
            ),
        ),
    ]
