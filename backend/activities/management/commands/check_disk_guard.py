"""Run Postgres disk guard check (same logic as Celery beat monitor)."""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Check Postgres disk usage, update Redis safeguards, write audit events.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--retention',
            action='store_true',
            help='Also run simulator activity retention cleanup if SCALE_SIM_ACTIVITY_RETENTION_DAYS > 0',
        )

    def handle(self, *args, **options):
        from activities.scale_disk_monitor import cleanup_simulated_activities, run_disk_monitor

        result = run_disk_monitor(source='manual')
        if result.get('skipped'):
            self.stdout.write(self.style.WARNING(f"Skipped: {result.get('reason')}"))
        else:
            pct = result.get('pct')
            pct_label = f'{pct * 100:.1f}%' if pct is not None else '—'
            self.stdout.write(
                self.style.SUCCESS(
                    f"Disk: {result.get('used_gb')} / {result.get('budget_gb')} GB ({pct_label}) "
                    f"→ {result.get('event_type')}: {result.get('action_taken')}"
                )
            )
            if result.get('simulation_paused'):
                self.stdout.write(self.style.WARNING('scale:simulation_paused=1'))
            if result.get('writes_blocked'):
                self.stdout.write(self.style.ERROR('scale:disk_writes_blocked=1'))

        if options['retention']:
            ret = cleanup_simulated_activities(source='manual')
            if ret.get('skipped'):
                self.stdout.write(f"Retention: {ret.get('reason')}")
            else:
                self.stdout.write(self.style.SUCCESS(f"Retention: deleted {ret.get('deleted', 0)} rows"))
