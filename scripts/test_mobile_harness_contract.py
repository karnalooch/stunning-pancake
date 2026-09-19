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

    def test_python_android_helpers_parse_and_have_no_hardcoded_serial(self):
        for path in ("scripts/emulator-ui-audit.py", "scripts/emulator-onboarding.py"):
            with self.subTest(path=path):
                source = read(path)
                ast.parse(source, filename=path)
                self.assertNotIn('["adb", "-s", "emulator-5554"]', source)
                self.assertIn("--serial", source)

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


if __name__ == "__main__":
    unittest.main()
