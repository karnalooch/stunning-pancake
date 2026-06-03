from django.apps import AppConfig


class ClubsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "clubs"
    verbose_name = "Clubs & Challenges"

    def ready(self) -> None:
        import clubs.signals  # noqa: F401 — registers Matrix provisioning signals
