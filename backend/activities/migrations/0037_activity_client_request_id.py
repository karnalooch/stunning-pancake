from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("activities", "0036_canonical_fourvelo_rls"),
    ]

    operations = [
        migrations.AddField(
            model_name="activity",
            name="client_request_id",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddConstraint(
            model_name="activity",
            constraint=models.UniqueConstraint(
                condition=models.Q(client_request_id__isnull=False)
                & ~models.Q(client_request_id=""),
                fields=("user", "client_request_id"),
                name="activities_activity_user_client_request_unique",
            ),
        ),
    ]
