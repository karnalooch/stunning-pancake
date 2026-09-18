#!/usr/bin/env python3
"""Execute the T94 mobile test selection produced by plan_affected_tests.py."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
MOBILE_ROOT = REPO_ROOT / "mobile"

MOBILE_SUITE_TESTS = {
    "gps_durability": (
        "__tests__/services/gpsActivityQueue.test.ts",
        "__tests__/services/gpsEncryptedStorage.test.ts",
        "__tests__/services/gpsFinalization.test.ts",
        "__tests__/services/gpsIngestAck.test.ts",
        "__tests__/services/gpsLocalExport.test.ts",
        "__tests__/services/gpsQualityFilter.test.ts",
        "__tests__/services/gpsSyncRecovery.test.ts",
        "__tests__/services/gpsSyncStorage.test.ts",
    ),
    "ride_safety": (
        "__tests__/components/RideActionBar.test.tsx",
        "__tests__/components/RideStatusBar.test.tsx",
        "__tests__/services/rideSessionService.test.ts",
        "__tests__/services/sessionDurability.t74.test.ts",
    ),
    "auth_security": (
        "__tests__/bootstrap/authRegistration.test.ts",
        "__tests__/screens/AuthScreen.test.tsx",
        "__tests__/screens/OnboardingScreen.test.tsx",
        "__tests__/services/apiClient.refresh.test.ts",
        "__tests__/services/apiClient.telemetry-token.test.ts",
        "__tests__/services/authTokenStorage.test.ts",
        "__tests__/services/socialAuth.test.ts",
    ),
    "asset_identity": (
        "__tests__/assets/assetGovernance.test.ts",
        "__tests__/assets/visionAssets.test.ts",
    ),
    "i18n_catalog": (
        "__tests__/i18n/catalogParity.test.ts",
    ),
}


def missing_mandatory_test_paths(root: Path = MOBILE_ROOT) -> list[str]:
    missing: list[str] = []
    for suite, tests in MOBILE_SUITE_TESTS.items():
        for test_path in tests:
            if not (root / test_path).is_file():
                missing.append(f"{suite}:{test_path}")
    return missing


def _mobile_relative(path: str) -> str:
    return path[len("mobile/") :] if path.startswith("mobile/") else path


def _dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


def _is_related_command(command: list[str]) -> bool:
    return "--findRelatedTests" in command


def _full_command() -> list[str]:
    return [
        "pnpm",
        "--dir",
        "mobile",
        "test",
        "--ci",
        "--forceExit",
    ]


def _discover_related_tests(command: list[str]) -> tuple[bool, list[str]]:
    probe = command + ["--listTests"]
    proc = subprocess.run(
        probe,
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        return False, []
    tests = [
        line.strip()
        for line in (proc.stdout or "").splitlines()
        if ".test." in line and "__tests__" in line
    ]
    return True, tests


def commands_for_plan(plan: dict[str, Any]) -> list[list[str]]:
    mobile = plan.get("mobile", {})
    mode = mobile.get("mode", "full")
    base = _full_command()

    if mode == "skip":
        return []
    if mode == "full":
        return [base]
    if mode != "related":
        # Unknown mode is not trusted.
        return [base]

    direct = [_mobile_relative(path) for path in mobile.get("directTests", [])]
    mandatory: list[str] = []
    for suite in mobile.get("mandatorySuites", []):
        tests = MOBILE_SUITE_TESTS.get(suite)
        if tests is None:
            return [base]
        mandatory.extend(tests)

    commands: list[list[str]] = []
    run_by_path = _dedupe(direct + mandatory)
    if run_by_path:
        commands.append(base + ["--runTestsByPath", *run_by_path])

    related = [
        str((REPO_ROOT / path).resolve())
        for path in mobile.get("relatedFiles", [])
        if path.startswith("mobile/") and (REPO_ROOT / path).exists()
    ]
    if related:
        commands.append(base + ["--findRelatedTests", *related])

    # The planner promised a narrow run but nothing executable survived:
    # fail safe to the normal full mobile Jest command.
    if not commands:
        return [base]
    return commands


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    missing = missing_mandatory_test_paths()
    if missing:
        print(
            "affected-mobile: mandatory suite mapping contains missing test files:",
            file=sys.stderr,
        )
        for entry in missing:
            print(f"  - {entry}", file=sys.stderr)
        return 2

    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    commands = commands_for_plan(plan)

    if not commands:
        print("affected-mobile: SKIP (no mobile runtime impact)")
        return 0

    print(f"affected-mobile: executing {len(commands)} planned command(s)")
    full_fallback_required = False

    for command in commands:
        if _is_related_command(command) and not args.dry_run:
            ok, discovered = _discover_related_tests(command)
            if not ok:
                print("affected-mobile: related-test discovery failed; FULL fallback")
                full_fallback_required = True
                continue
            if not discovered:
                print("affected-mobile: zero related tests discovered; FULL fallback")
                full_fallback_required = True
                continue
            print(f"affected-mobile: related-test discovery found {len(discovered)} test file(s)")

        print("  + " + " ".join(command))
        if args.dry_run:
            continue
        proc = subprocess.run(command, cwd=REPO_ROOT, check=False)
        if proc.returncode != 0:
            return proc.returncode

    if full_fallback_required:
        command = _full_command()
        print("  + " + " ".join(command))
        proc = subprocess.run(command, cwd=REPO_ROOT, check=False)
        return proc.returncode

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
