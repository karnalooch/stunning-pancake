"""Privacy lifecycle hooks that cannot be expressed as Django FK cascades."""

from django.contrib.auth import get_user_model
from django.db.models.signals import pre_delete
from django.dispatch import receiver

from users.data_lifecycle import delete_user_personal_data


@receiver(pre_delete, sender=get_user_model())
def purge_non_model_user_data(sender, instance, **kwargs) -> None:
    """Remove telemetry rows and export objects before the User row disappears."""

    del sender, kwargs
    if instance.pk is None:
        return
    delete_user_personal_data(instance)
