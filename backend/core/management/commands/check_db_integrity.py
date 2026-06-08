from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from events.models import Participation


class Command(BaseCommand):
    help = "Checks database integrity between users and participations."

    def add_arguments(self, parser):
        parser.add_argument("--env", type=str, help="Environment name")

    def handle(self, *args, **options):
        env = options.get("env")
        self.stdout.write(self.style.SUCCESS(f"Starting database integrity check (env={env})..."))

        User = get_user_model()

        # 1. Check for orphaned participations
        orphaned_participations = Participation.objects.exclude(
            user_id__in=User.objects.values_list("id", flat=True)
        )
        if orphaned_participations.exists():
            self.stdout.write(
                self.style.WARNING(
                    f"Found {orphaned_participations.count()} orphaned participations!"
                )
            )
            for p in orphaned_participations:
                self.stdout.write(
                    self.style.ERROR(
                        f"  Participation ID: {p.id} points to non-existent User ID: {p.user_id}"
                    )
                )
        else:
            self.stdout.write(self.style.SUCCESS("No orphaned participations found."))

        # 2. Check tenant consistency
        inconsistent_tenants = 0
        for p in Participation.objects.select_related("user", "event"):
            event = p.event
            user = p.user
            if event.tenant_id and user.tenant_id != event.tenant_id:
                # For INTER_TENANT, check opponent as well
                if (
                    event.event_type == "INTER_TENANT"
                    and user.tenant_id == event.opponent_tenant_id
                ):
                    continue

                self.stdout.write(
                    self.style.WARNING(
                        f"Tenant mismatch: User {user.username} (tenant={user.tenant_id}) "
                        f"participates in Event {event.title} (tenant={event.tenant_id})"
                    )
                )
                inconsistent_tenants += 1

        if inconsistent_tenants > 0:
            self.stdout.write(
                self.style.WARNING(f"Found {inconsistent_tenants} inconsistent tenant assignments.")
            )
        else:
            self.stdout.write(self.style.SUCCESS("Tenant consistency check passed."))

        self.stdout.write(self.style.SUCCESS("Integrity check complete."))
