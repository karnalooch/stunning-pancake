# Generated migration for Department and UserDepartment models
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0011_migrate_legacy_roles'),
    ]

    operations = [
        migrations.CreateModel(
            name='Department',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('department_type', models.CharField(choices=[('department', 'Department'), ('class', 'Class'), ('faculty', 'Faculty'), ('team', 'Team'), ('district', 'District'), ('other', 'Other')], default='department', max_length=50)),
                ('description', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('moderator', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='moderated_departments', to='users.user')),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='children', to='users.department')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='departments', to='users.tenant')),
            ],
            options={
                'ordering': ['name'],
                'unique_together': {('tenant', 'name')},
            },
        ),
        migrations.CreateModel(
            name='UserDepartment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='users.department')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='users.user')),
            ],
            options={
                'ordering': ['joined_at'],
                'unique_together': {('user', 'department')},
            },
        ),
    ]
