"""Management command: warm Redis cache before event go-live."""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Reset burst counters and cache event metadata in Redis (same as warm_event_start task)."

    def add_arguments(self, parser):
        parser.add_argument("event_id", type=int, help="Event primary key")

    def handle(self, *args, **options):
        from events.tasks import warm_event_start

        event_id = options["event_id"]
        warm_event_start(event_id)
        self.stdout.write(self.style.SUCCESS(f"Warmed event {event_id}"))
