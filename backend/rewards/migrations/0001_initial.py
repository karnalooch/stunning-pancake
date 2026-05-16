# Generated manually — rewards migrations were missing

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Sponsor',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('logo_url', models.URLField(blank=True)),
                ('website', models.URLField(blank=True)),
                ('tenant_id', models.CharField(blank=True, db_index=True, max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sponsor_profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='VoucherPool',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('points_required', models.PositiveIntegerField()),
                ('valid_from', models.DateTimeField()),
                ('valid_until', models.DateTimeField()),
                ('max_redemptions', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('sponsor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pools', to='rewards.sponsor')),
            ],
            options={
                'ordering': ['-valid_from'],
            },
        ),
        migrations.CreateModel(
            name='Voucher',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=64, unique=True)),
                ('redeemed_at', models.DateTimeField(blank=True, null=True)),
                ('is_used', models.BooleanField(default=False)),
                ('pool', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='vouchers', to='rewards.voucherpool')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='vouchers', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'indexes': [models.Index(fields=['user', 'is_used'], name='voucher_user_used_idx')],
            },
        ),
        migrations.CreateModel(
            name='PointsLedger',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('delta', models.IntegerField()),
                ('reason', models.CharField(choices=[('ACTIVITY_VERIFIED', 'Activity Verified'), ('EVENT_BONUS', 'Event Bonus'), ('VOUCHER_REDEEM', 'Voucher Redeemed'), ('ADMIN_ADJUST', 'Admin Adjustment')], max_length=30)),
                ('reference_id', models.CharField(blank=True, max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='points_ledger', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['user', 'created_at'], name='pledger_user_created_idx')],
            },
        ),
    ]
