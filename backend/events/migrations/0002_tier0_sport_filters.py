from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="event",
            name="sport_filter",
            field=models.CharField(
                choices=[
                    ("ALL", "All Sports (Run / Bike / Nordic Walking)"),
                    ("RUN", "Running Only"),
                    ("BIKE", "Cycling Only"),
                    ("WALK", "Nordic Walking Only"),
                    ("RUN_BIKE", "Running & Cycling"),
                    ("RUN_BIKE_WALK", "Running, Cycling & Nordic Walking"),
                ],
                default="ALL",
                max_length=16,
            ),
        ),
    ]
