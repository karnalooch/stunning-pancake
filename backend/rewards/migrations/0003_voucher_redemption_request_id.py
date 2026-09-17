from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("rewards", "0002_sponsor_campaign"),
    ]

    operations = [
        migrations.AddField(
            model_name="voucher",
            name="redemption_request_id",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddConstraint(
            model_name="voucher",
            constraint=models.UniqueConstraint(
                condition=models.Q(redemption_request_id__isnull=False)
                & ~models.Q(redemption_request_id=""),
                fields=("user", "pool", "redemption_request_id"),
                name="rewards_voucher_user_pool_request_unique",
            ),
        ),
        migrations.AddConstraint(
            model_name="pointsledger",
            constraint=models.UniqueConstraint(
                condition=models.Q(reason__in=("ACTIVITY_VERIFIED", "VOUCHER_REDEEM"))
                & ~models.Q(reference_id=""),
                fields=("user", "reason", "reference_id"),
                name="rewards_ledger_critical_effect_unique",
            ),
        ),
    ]
