"""Fail closed when mobile Android verification helpers regress to machine-specific or optional critical flows."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class MobileHarnessContractTests(unittest.TestCase):
    def test_live_android_env_has_no_historical_g_drive_assignment(self):
        source = read("scripts/android-env.ps1")
        self.assertNotIn('G:\\android-sdk', source)
        self.assertIn("ANDROID_SDK_ROOT", source)
        self.assertIn("LOCALAPPDATA", source)

    def test_legacy_gdrive_helper_is_only_a_wrapper(self):
        source = read("scripts/android-sdk-gdrive.ps1")
        self.assertIn("deprecated", source.lower())
        self.assertIn("android-env.ps1", source)
        self.assertNotIn('$env:ANDROID_HOME = "G:', source)

    def test_visual_harness_defines_sdk_root_and_requires_unambiguous_device(self):
        source = read("scripts/vision-parity-full-harness.ps1")
        self.assertIn("$sdkRoot = $env:ANDROID_SDK_ROOT", source)
        self.assertIn("Multiple Android devices are online", source)
        self.assertNotIn('[string]$DeviceId = "emulator-5554"', source)
        self.assertLess(
            source.index('expo", "prebuild", "--clean"'),
            source.index('"sdk.dir=$escapedSdk"'),
            "local.properties must be written after clean prebuild",
        )

    def test_visual_harness_uses_pinned_cli_entrypoints(self):
        source = read("scripts/vision-parity-full-harness.ps1")
        self.assertIn('"pnpm" @("exec", "expo", "prebuild"', source)
        self.assertIn('"dlx", "eas-cli@24.7.0", "build"', source)
        self.assertNotIn('"npx" @("eas"', source)

    def test_python_android_helpers_parse_and_have_no_hardcoded_serial(self):
        for path in ("scripts/emulator-ui-audit.py", "scripts/emulator-onboarding.py"):
            with self.subTest(path=path):
                source = read(path)
                ast.parse(source, filename=path)
                self.assertNotIn('["adb", "-s", "emulator-5554"]', source)
                self.assertIn("--serial", source)

    def test_zero_baseline_collector_is_machine_neutral_and_privacy_safe(self):
        source = read("scripts/mobile-zero-baseline.ps1")
        runbook = read("docs/audits/MOBILE_ABSOLUTE_ZERO_REVALIDATION_2026-09-19.md")

        self.assertNotIn("D:\\gem\\stunning-pancake", source)
        self.assertNotIn("D:\\gem\\stunning-pancake", runbook)
        self.assertNotIn('return "com.sport.athlete"', source)

        for token in (
            "function Protect-EvidenceText",
            "function Get-EvidenceId",
            "%USERPROFILE%",
            "E2E_EMAIL",
            "serialHash",
            "commands = $commandEvidence",
            "ReadToEndAsync",
            "mobileMmkv",
            "mobileNitro",
        ):
            with self.subTest(token=token):
                self.assertIn(token, source)

        self.assertNotIn("$androidInventory.adb = $adbInfo", source)
        self.assertIn(r"([^/@\s]+)@", source)
        self.assertNotIn(r"([^/@\\s]+)@", source)
        self.assertIn("$RepoRoot = (git rev-parse --show-toplevel).Trim()", runbook)

        # Windows package-manager/tool shims must be executable by the collector
        # even when Corepack exposes .cmd/.bat/.ps1 wrappers instead of PE files.
        for token in (
            '"$Name.cmd"',
            '"$Name.bat"',
            '"$Name.ps1"',
            '$extension -eq ".cmd"',
            '$extension -eq ".bat"',
            '$extension -eq ".ps1"',
            '$env:ComSpec',
            'powershell.exe',
        ):
            with self.subTest(token=token):
                self.assertIn(token, source)

        # @babel/runtime intentionally exposes helper subpaths rather than a
        # resolvable package root in the pinned version.
        self.assertNotIn('    "@babel/runtime",', source)
        for helper in (
            "@babel/runtime/helpers/asyncToGenerator",
            "@babel/runtime/helpers/defineProperty",
            "@babel/runtime/helpers/objectSpread2",
        ):
            with self.subTest(helper=helper):
                self.assertIn(helper, source)

    def test_exact_sha_acceptance_harness_is_fail_closed_and_provenanced(self):
        source = read("scripts/mobile-runtime-acceptance.ps1")
        gitignore = read(".gitignore")

        for token in (
            "Worktree must be clean for exact-SHA runtime acceptance",
            "scripts\\android-env.ps1",
            "validate_mobile_native_provenance.py",
            "Get-FileHash -Algorithm SHA256",
            "EXPO_PUBLIC_VISION_FIXTURES",
            "EXPO_PUBLIC_E2E_SKIP_ONBOARDING",
            "--output-dir",
            "--report",
            "01_ride_dashboard.png",
            "02_active_ride_hud.png",
            "03_ride_paused.png",
            "03b_ride_resumed.png",
            "03d_ride_summary.png",
            "03e_home_after_summary.png",
            "AUTOMATION_PASS",
            "provenance.json",
        ):
            with self.subTest(token=token):
                self.assertIn(token, source)

        self.assertLess(
            source.index('expo", "prebuild", "--clean"'),
            source.index('"sdk.dir=$escapedSdk"'),
            "local.properties must be written only after clean prebuild",
        )
        self.assertIn("artifacts/mobile-runtime-acceptance/", gitignore)
        self.assertNotIn("emulator-5554", source)

    def test_emulator_audit_supports_external_evidence_bundle_paths(self):
        source = read("scripts/emulator-ui-audit.py")
        for token in (
            '"--output-dir"',
            '"--report"',
            "REPORT.parent.mkdir(parents=True, exist_ok=True)",
            "os.path.relpath",
        ):
            with self.subTest(token=token):
                self.assertIn(token, source)

    def test_stale_machine_specific_pilot_helpers_are_removed(self):
        self.assertFalse((ROOT / "mobile" / "eas-wsl-build.sh").exists())
        self.assertFalse((ROOT / "mobile" / "scripts" / "register_pilot.sh").exists())

    def test_ride_lifecycle_smoke_is_real_and_blocking(self):
        source = read("mobile/.maestro/flows/ride-lifecycle.yaml")
        self.assertNotIn("optional: true", source)
        for token in ("START JAZDY", "PAUZA", "WZNÓW", "ZATRZYMAJ JAZDĘ", "Jazda ukończona", "POWRÓT"):
            with self.subTest(token=token):
                self.assertIn(token, source)

    def test_full_audit_critical_ride_prefix_has_no_optional_steps(self):
        source = read("mobile/.maestro/flows/emulator-full-audit.yaml")
        critical, _, _secondary = source.partition('text: "KREATOR GPS"')
        self.assertNotIn("optional: true", critical)
        for token in ("START JAZDY", "PAUZA", "WZNÓW", "ZATRZYMAJ JAZDĘ", "Jazda ukończona"):
            with self.subTest(token=token):
                self.assertIn(token, critical)

    def test_python_ride_audit_accepts_stable_transition_ids(self):
        source = read("scripts/emulator-ui-audit.py")
        for token in (
            "home-start-ride",
            "active-ride-screen",
            "ride-pause-button",
            "ride-paused-screen",
            "ride-paused-resume",
            "ride-paused-stop",
            "ride-summary-screen",
            "ride-summary-durable-success",
            "ride-summary-back-home",
        ):
            with self.subTest(token=token):
                self.assertIn(token, source)

    def test_ride_screens_expose_stable_transition_ids(self):
        expectations = {
            "mobile/src/screens/RideDashboardScreen.tsx": ("home-start-ride",),
            "mobile/src/screens/ActiveRideHUDScreen.tsx": ("active-ride-screen",),
            "mobile/src/components/ride/RideActionBar.tsx": (
                "ride-pause-button",
                "ride-stop-button",
            ),
            "mobile/src/screens/RidePausedScreen.tsx": (
                "ride-paused-screen",
                "ride-paused-resume",
                "ride-paused-stop",
            ),
            "mobile/src/screens/RideSummaryScreen.tsx": (
                "ride-summary-screen",
                "ride-summary-back-home",
            ),
        }
        for path, tokens in expectations.items():
            source = read(path)
            for token in tokens:
                with self.subTest(path=path, token=token):
                    self.assertIn(token, source)


if __name__ == "__main__":
    unittest.main()
