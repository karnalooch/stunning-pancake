# Generated manually — adds Stripe fields to User and Tenant models (Milestone 4)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0007_auditlog_fk_and_tenant"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="stripe_customer_id",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="stripe_connect_id",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="tenant",
            name="stripe_account_id",
            field=models.CharField(
                blank=True,
                help_text="Connected account ID for sponsor payouts",
                max_length=100,
                null=True,
            ),
        ),
    ]
