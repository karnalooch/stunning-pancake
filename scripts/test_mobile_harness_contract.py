"""Fail closed when mobile Android verification helpers regress to machine-specific or optional critical flows."""

from __future__ import annotations

import ast
import json
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
        metro_config = read("mobile/metro.config.js")
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
            "physical-signoff.md",
            "settings get system font_scale",
            "settings get system screen_brightness_mode",
            "settings get system screen_brightness",
            "wm size",
            "wm density",
            "First-use flow succeeds without explanation from the reviewer",
            "Active Ride remains readable in outdoor/sunlight conditions",
            "Primary ride controls are reachable and understandable one-handed",
            "Pending finalization is visually distinct from durable success",
            "[switch]$UseCiArtifact",
            "gh run list",
            'Invoke-Checked "gh" @("run", "download"',
            "mobile-runtime-$CiRunId",
            "CI artifact source SHA mismatch",
            "CI artifact built SHA mismatch",
            "CI artifact APK SHA-256 mismatch",
            "MOBILE_RUNTIME_ACCEPTANCE",
            '$env:NODE_ENV = "production"',
            '"pm", "clear", "com.sport.athlete"',
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
        self.assertNotIn("$LASTEXITCODE:", source)
        self.assertIn("${LASTEXITCODE}:", source)
        self.assertNotIn("$gitSha:", source)
        self.assertIn("${gitSha}:", source)
        self.assertIn('$gitBranch = "DETACHED"', source)

        mobile_package = json.loads(read("mobile/package.json"))
        self.assertEqual(mobile_package["devDependencies"]["babel-preset-expo"], "55.0.25")

        workspace = read("pnpm-workspace.yaml")
        self.assertIn("nodeLinker: isolated", workspace)
        self.assertNotIn("virtualStoreDir: .pnpm", workspace)
        self.assertIn("virtualStoreDirMaxLength: 40", workspace)
        self.assertIn(".pnpm/", gitignore)
        self.assertIn('$originalWorkspaceBytes = [System.IO.File]::ReadAllBytes($workspaceConfig)', source)
        self.assertIn('virtualStoreDir: `"$shortVirtualStoreYaml`"', source)
        self.assertIn('virtualStoreDirMaxLength: 16', source)
        self.assertIn('[System.IO.File]::WriteAllBytes($workspaceConfig, $originalWorkspaceBytes)', source)
        self.assertIn('pnpmVirtualStore = $shortVirtualStore', source)
        self.assertIn('$env:EXPO_METRO_PNPM_VIRTUAL_STORE = $shortVirtualStore', source)
        self.assertIn('$heapBaseline = "-Xmx2048m"', source)
        self.assertIn('"-Xmx4096m"', source)
        self.assertIn('Generated gradle.properties no longer contains the expected 2048m heap baseline.', source)
        self.assertIn('$metaspaceBaseline = "-XX:MaxMetaspaceSize=512m"', source)
        self.assertIn('"-XX:MaxMetaspaceSize=1g"', source)
        self.assertIn('Generated gradle.properties no longer contains the expected 512m metaspace baseline.', source)
        self.assertIn('"--max-workers=2"', source)
        self.assertIn('process.env.EXPO_METRO_PNPM_VIRTUAL_STORE', metro_config)
        self.assertIn('config.watchFolders = Array.from(', metro_config)
        self.assertIn('fs.existsSync(resolvedVirtualStore)', metro_config)
        self.assertLess(
            source.index('virtualStoreDirMaxLength: 16'),
            source.index('pnpm exec expo config --type public --json'),
            "short-store frozen workspace install must precede Expo/native generation",
        )


    def test_mobile_native_smoke_requires_debug_and_release_parity(self):
        workflow = read(".github/workflows/mobile-native-smoke.yml")

        self.assertIn('ref: ${{ inputs.source_sha || github.event.pull_request.head.sha || github.sha }}', workflow)
        self.assertIn("Assert exact source checkout", workflow)
        self.assertIn("Exact source checkout mismatch", workflow)
        self.assertIn("NODE_ENV: production", workflow)
        self.assertIn('MOBILE_RUNTIME_ACCEPTANCE: "true"', workflow)
        self.assertIn("runtime acceptance requires Expo updates.enabled=false", workflow)
        self.assertIn("Built Git SHA mismatch", workflow)
        self.assertIn('"updatesEnabled": False', workflow)
        self.assertIn('"runtimeAcceptance": os.environ["MOBILE_RUNTIME_ACCEPTANCE"]', workflow)
        self.assertIn("./gradlew assembleDebug --no-daemon --stacktrace", workflow)
        self.assertIn("./gradlew assembleRelease --no-daemon --stacktrace", workflow)
        self.assertIn('grep -F -- "-Xmx2048m" "$GRADLE_PROPERTIES"', workflow)
        self.assertIn("sed -i 's/-Xmx2048m/-Xmx4096m/'", workflow)
        self.assertIn('grep -F -- "-XX:MaxMetaspaceSize=512m" "$GRADLE_PROPERTIES"', workflow)
        self.assertIn("sed -i 's/-XX:MaxMetaspaceSize=512m/-XX:MaxMetaspaceSize=1g/'", workflow)
        self.assertIn("./gradlew assembleRelease --no-daemon --stacktrace --max-workers=2", workflow)
        self.assertIn("mobile/android/app/build/outputs/apk/debug/app-debug.apk", workflow)
        self.assertIn("mobile/android/app/build/outputs/apk/release/app-release.apk", workflow)
        self.assertIn("Prepare exact-SHA runtime artifact", workflow)
        self.assertIn("Upload exact-SHA runtime artifact", workflow)
        self.assertIn("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02", workflow)
        self.assertIn('name: mobile-runtime-${{ github.run_id }}', workflow)
        self.assertIn('"sourceHeadSha"', workflow)
        self.assertIn('"apkSha256"', workflow)
        self.assertIn('"workflowRunId"', workflow)
        self.assertLess(
            workflow.index("./gradlew assembleDebug --no-daemon --stacktrace"),
            workflow.index("./gradlew assembleRelease --no-daemon --stacktrace"),
            "release parity must run after the debug native compile",
        )


    def test_windows_release_smoke_matches_local_release_path(self):
        workflow = read(".github/workflows/mobile-windows-release-smoke.yml")

        for token in (
            "runs-on: windows-latest",
            'git worktree add --detach "C:\\w" "$env:GITHUB_SHA"',
            '"SHORT_WORKSPACE=C:\\w" >> $env:GITHUB_ENV',
            'Set-Location "$env:SHORT_WORKSPACE\\mobile\\android"',
            ". .\\scripts\\android-env.ps1",
            '$originalWorkspaceConfig = Get-Content -Raw $workspaceConfig',
            'virtualStoreDir: `"C:/v`"',
            'virtualStoreDirMaxLength: 16',
            'pnpm install --frozen-lockfile',
            '"EXPO_METRO_PNPM_VIRTUAL_STORE=$virtualStore" >> $env:GITHUB_ENV',
            'Set-Content -Path $workspaceConfig -Value $originalWorkspaceConfig',
            "expo prebuild --clean --platform android --no-install",
            "android\\local.properties",
            '$heapBaseline = "-Xmx2048m"',
            '"-Xmx4096m"',
            "Generated gradle.properties no longer contains the expected 2048m heap baseline.",
            '$metaspaceBaseline = "-XX:MaxMetaspaceSize=512m"',
            '"-XX:MaxMetaspaceSize=1g"',
            "Generated gradle.properties no longer contains the expected 512m metaspace baseline.",
            "cmd /c gradlew.bat assembleRelease --no-daemon --stacktrace --max-workers=2",
            "mobile\\android\\app\\build\\outputs\\apk\\release\\app-release.apk",
            "Get-FileHash -Algorithm SHA256",
        ):
            with self.subTest(token=token):
                self.assertIn(token, workflow)

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

    def test_runtime_audit_requires_first_run_onboarding_and_persistence(self):
        source = read("scripts/emulator-ui-audit.py")
        app_root = read("mobile/src/app/AppRoot.tsx")
        auth_session = read("mobile/src/bootstrap/useAuthSession.ts")
        storage = read("mobile/src/bootstrap/storage.ts")

        self.assertIn("MAIN_SHELL_PATTERN", source)
        self.assertIn("ui_has_pattern(MAIN_SHELL_PATTERN)", source)
        self.assertIn("Fresh runtime acceptance entered the main shell before onboarding", source)
        self.assertIn("Onboarding completion persisted across app restart", source)
        self.assertIn('"force-stop", APP_ID', source)
        self.assertNotIn("Vision fixtures — onboarding intentionally bypassed by AppRoot", source)
        self.assertNotIn("Vision fixtures nie ominęły onboardingu zgodnie z kontraktem AppRoot", source)

        self.assertIn("if (!auth.isOnboarded.get())", app_root)
        self.assertNotIn("&& !isVisionFixtures()", app_root)
        self.assertIn("isOnboardingCompleteGlobal()", auth_session)
        self.assertIn("auth.isOnboarded.set(", auth_session)
        self.assertIn("export function isOnboardingCompleteGlobal()", storage)


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
