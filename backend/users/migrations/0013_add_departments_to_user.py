# Add departments ManyToMany field to User model
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0012_department"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="departments",
            field=models.ManyToManyField(
                blank=True,
                help_text="Departments this user belongs to",
                related_name="members",
                through="users.UserDepartment",
                to="users.department",
            ),
        ),
    ]
