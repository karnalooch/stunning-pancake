"""Rewards app configuration."""

from django.apps import AppConfig


class RewardsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "rewards"
    verbose_name = "Rewards & Voucher Marketplace"

    def ready(self) -> None:
        pass  # Reserved for future signal registration
