"""Update live simulator active_ratio in Redis without restarting the session."""

from django.core.management.base import BaseCommand, CommandError

from activities import simulator_state as sim


class Command(BaseCommand):
    help = "Set live simulation active_ratio (0–1) while running or stopped"

    def add_arguments(self, parser):
        parser.add_argument(
            "ratio",
            type=float,
            help="Target active_ratio, e.g. 0.18 for 18%% of pool riding",
        )
        parser.add_argument(
            "--show",
            action="store_true",
            help="Print current live state and exit (ignores ratio if only inspecting)",
        )

    def handle(self, *args, **options):
        state = sim.get_live_state()
        if options["show"]:
            self.stdout.write(
                f"running={state.get('running')} active_ratio={state.get('active_ratio')} "
                f"total_users={state.get('total_users')} currently_riding={state.get('currently_riding')}"
            )
            return

        ratio = float(options["ratio"])
        if ratio <= 0 or ratio > 1:
            raise CommandError("ratio must be between 0 and 1 (exclusive of 0)")

        prev = float(state.get("active_ratio") or 0)
        sim.set_live_state(active_ratio=ratio)
        sim.live_log(
            f"active_ratio adjusted {prev * 100:.0f}% -> {ratio * 100:.0f}% (management command)"
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"active_ratio {prev:.3f} -> {ratio:.3f} "
                f"(running={state.get('running')}, total_users={state.get('total_users')})"
            )
        )
