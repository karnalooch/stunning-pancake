#!/usr/bin/env python3
"""Execute backend domain suites from the T94 affected-test plan."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ROOT = REPO_ROOT / "backend"

SIMULATOR_LIGHT = (
    "activities/test_simulator_authority.py",
    "activities/test_simulator_backpressure.py",
    "activities/test_simulator_status_views.py",
    "activities/test_simulator_routing.py",
    "activities/test_simulator_operational_gate.py",
)

P1_CRITICAL = (
    "activities/test_tenant_moderator_scope.py",
    "activities/test_anomaly_queue.py",
    "activities/test_sim_lab_proxy.py",
    "activities/test_gpx_export.py",
    "activities/test_gpx_forensics.py",
    "activities/test_gpx_storage.py",
    "rewards/test_pools.py",
    "users/test_export.py",
    "users/test_jwt_mfa.py",
    "core/test_oauth_state.py",
    "test_openapi_schema.py",
    "activities/test_live_map_webhooks.py",
    "users/test_department_tenant_scope.py",
    "activities/test_moderation_tenant_scope.py",
    "activities/test_heatmap_tenant_scope.py",
)

BACKEND_SUITE_TESTS = {
    "activity_durability": (
        "activities/test_durable_finalization_p3.py",
        "activities/test_p3_activity_read_scope.py",
        "activities/test_p3_tenant_activity_create.py",
        "activities/test_route_sync.py",
        "activities/test_telemetry_shard.py",
        "activities/test_telemetry_token_view.py",
        "activities/tests/test_t74_idempotency.py",
    ),
    "tenant_security": (
        "activities/test_tenant_moderator_scope.py",
        "activities/test_moderation_tenant_scope.py",
        "activities/test_heatmap_tenant_scope.py",
        "activities/test_p3_activity_read_scope.py",
        "activities/test_p3_tenant_activity_create.py",
        "clubs/test_p3_tenant_scope.py",
        "users/test_department_tenant_scope.py",
        "users/test_p3_profile_tenant_guard.py",
    ),
    "gpx_data": (
        "activities/test_gpx_export.py",
        "activities/test_gpx_forensics.py",
        "activities/test_gpx_storage.py",
    ),
    "live_map": (
        "activities/test_live_map_aggregate.py",
        "activities/test_live_map_api.py",
        "activities/test_live_map_audit.py",
        "activities/test_live_map_read_policy.py",
        "activities/test_live_map_replay.py",
        "activities/test_live_map_webhooks.py",
    ),
    "data_lifecycle": (
        "users/test_data_lifecycle.py",
        "users/test_export.py",
        "activities/test_wipe_flow.py",
        "activities/test_wipe_state.py",
    ),
    "users_domain": (
        "users/test_admin.py",
        "users/test_audit_log_integrity.py",
        "users/test_data_lifecycle.py",
        "users/test_department_tenant_scope.py",
        "users/test_export.py",
        "users/test_p3_profile_tenant_guard.py",
        "users/test_rbac.py",
    ),
    "clubs_domain": (
        "clubs/test_p3_tenant_scope.py",
    ),
    "rewards_domain": (
        "rewards/test_pools.py",
        "rewards/tests/test_sponsor_scope.py",
        "rewards/tests/test_t74_idempotency.py",
    ),
    "events_domain": (
        "events/test_event_burst.py",
    ),
    "wearables": (
        "activities/test_wearables.py",
    ),
    "activities_general": (
        "activities/test_gps_signal_processing.py",
        "activities/test_leaderboard_credit.py",
        "activities/test_tasks.py",
    ),
}


def _backend_relative(path: str) -> str:
    return path[len("backend/") :] if path.startswith("backend/") else path


def _dedupe(items):
    return list(dict.fromkeys(items))


def commands_for_plan(plan: dict[str, Any]) -> list[list[str]]:
    backend = plan.get("backend", {})
    mode = backend.get("mode", "full")

    if mode == "skip":
        return []

    if mode == "full":
        return [
            ["python", "run_pytest.py", *SIMULATOR_LIGHT, "-m", "simulator_light", "-v"],
            ["python", "-m", "pytest", "test_rls.py", "-v"],
            ["python", "run_pytest.py", *P1_CRITICAL, "-q"],
        ]

    if mode != "domain":
        return commands_for_plan({"backend": {"mode": "full"}})

    suites = backend.get("mandatorySuites", [])
    direct = [_backend_relative(path) for path in backend.get("directTests", [])]

    regular_tests: list[str] = list(direct)
    need_simulator = False
    need_rls = False

    for suite in suites:
        if suite == "simulator_light":
            need_simulator = True
        elif suite == "rls":
            need_rls = True
        elif suite == "p1_critical":
            regular_tests.extend(P1_CRITICAL)
        elif suite in BACKEND_SUITE_TESTS:
            regular_tests.extend(BACKEND_SUITE_TESTS[suite])
        else:
            # Unknown suite cannot safely narrow.
            return commands_for_plan({"backend": {"mode": "full"}})

    commands: list[list[str]] = []
    if need_simulator:
        commands.append(
            ["python", "run_pytest.py", *SIMULATOR_LIGHT, "-m", "simulator_light", "-v"]
        )
    if need_rls:
        commands.append(["python", "-m", "pytest", "test_rls.py", "-v"])

    regular_tests = _dedupe(regular_tests)
    if regular_tests:
        commands.append(["python", "run_pytest.py", *regular_tests, "-q"])

    if not commands:
        return commands_for_plan({"backend": {"mode": "full"}})
    return commands


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    commands = commands_for_plan(plan)

    if not commands:
        print("affected-backend: SKIP (no backend runtime impact)")
        return 0

    print(f"affected-backend: executing {len(commands)} command(s)")
    for command in commands:
        print("  + " + " ".join(command))
        if args.dry_run:
            continue
        proc = subprocess.run(command, cwd=BACKEND_ROOT, check=False)
        if proc.returncode != 0:
            return proc.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
