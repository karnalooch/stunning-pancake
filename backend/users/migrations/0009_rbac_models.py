"""
Migration: Add RBAC models (Permission, Role, RolePermission, UserRole)
Backward-compatible: preserves existing User.role field.
"""
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_add_stripe_fields'),
    ]

    operations = [
        # Permission model
        migrations.CreateModel(
            name='Permission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codename', models.CharField(max_length=100, unique=True)),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('resource', models.CharField(max_length=50)),
                ('action', models.CharField(max_length=50)),
            ],
            options={
                'ordering': ['resource', 'action'],
                'unique_together': {('resource', 'action')},
            },
        ),
        # Role model
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.CharField(choices=[('global_owner', 'Global Owner'), ('tenant_admin', 'Tenant Admin'), ('tenant_moderator', 'Tenant Moderator'), ('sponsor', 'Sponsor'), ('athlete', 'Athlete')], max_length=50, unique=True)),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('is_system', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['slug'],
            },
        ),
        # RolePermission through model
        migrations.CreateModel(
            name='RolePermission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tenant_scoped', models.BooleanField(default=False)),
                ('permission', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='users.permission')),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='users.role')),
            ],
            options={
                'unique_together': {('role', 'permission')},
            },
        ),
        # UserRole model
        migrations.CreateModel(
            name='UserRole',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tenant_scoped', models.BooleanField(default=False)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('granted_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='granted_roles', to='users.user')),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='users.role')),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='users.tenant')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='role_assignments', to='users.user')),
            ],
            options={
                'ordering': ['-created_at'],
                'unique_together': {('user', 'role', 'tenant')},
            },
        ),
        # Add M2M field on Role for permissions
        migrations.AddField(
            model_name='role',
            name='permissions',
            field=models.ManyToManyField(blank=True, through='users.RolePermission', to='users.permission'),
        ),
    ]
