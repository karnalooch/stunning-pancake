"""Contract for cost-aware, fail-closed Mobile Native Smoke routing."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "mobile-native-smoke.yml"


def workflow_text() -> str:
    return WORKFLOW.read_text(encoding="utf-8")


def native_filter_block(text: str) -> str:
    marker = "            native:\n"
    start = text.index(marker) + len(marker)
    end = text.index("\n\n      - name: Decide whether Gradle is required", start)
    return text[start:end]


class MobileNativeSmokeWorkflowTests(unittest.TestCase):
    def test_pr_trigger_stays_broad_so_smoke_check_is_visible(self):
        text = workflow_text()
        self.assertIn('      - "mobile/**"', text)
        self.assertIn("  pull_request:", text)

    def test_native_filter_is_narrow_and_fail_closed(self):
        block = native_filter_block(workflow_text())

        required = (
            "mobile/app.config.js",
            "mobile/app.json",
            "mobile/eas.json",
            "mobile/package.json",
            "mobile/android/**",
            "mobile/ios/**",
            "mobile/plugins/**",
            "mobile/google-services.json",
            "mobile/GoogleService-Info.plist",
            "mobile/assets/icon.png",
            "mobile/assets/splash-icon.png",
            "mobile/assets/adaptive-icon.png",
            "package.json",
            "pnpm-lock.yaml",
            "pnpm-workspace.yaml",
            ".npmrc",
            ".github/actions/pnpm-setup/**",
            "version.json",
            "scripts/validate_mobile_native_provenance.py",
            "scripts/test_mobile_native_provenance.py",
            "scripts/test_mobile_native_smoke_workflow.py",
            ".github/workflows/mobile-native-smoke.yml",
        )
        for path in required:
            with self.subTest(path=path):
                self.assertIn(path, block)

        excluded = (
            "mobile/**",
            "mobile/src/**",
            "mobile/__tests__/**",
            "mobile/assets/approved/**",
            "assets/**",
            "docs/**",
            "packages/**",
        )
        for path in excluded:
            with self.subTest(path=path):
                self.assertNotIn(path, block)

    def test_full_android_build_is_conditioned_on_scope_decision(self):
        text = workflow_text()
        self.assertIn("  native-scope:", text)
        self.assertIn("    needs: [native-scope]", text)
        self.assertIn("    if: needs.native-scope.outputs.run == 'true'", text)
        self.assertIn("pnpm exec expo prebuild --clean --platform android --no-install", text)
        self.assertIn("./gradlew assembleDebug --no-daemon --stacktrace", text)

    def test_non_pr_runs_force_native_smoke_and_weekly_drift_check_exists(self):
        text = workflow_text()
        self.assertIn('if [ "$EVENT_NAME" != "pull_request" ]; then', text)
        self.assertIn('echo "run=true" >> "$GITHUB_OUTPUT"', text)
        self.assertIn('cron: "30 3 * * 1"', text)
        self.assertIn("    branches: [main]", text)

    def test_scope_detection_has_minimal_pr_permission(self):
        text = workflow_text()
        self.assertIn("  contents: read", text)
        self.assertIn("  pull-requests: read", text)
        self.assertIn(
            "uses: dorny/paths-filter@0e4a8c6effa4802afeda77dc8d303f8176d7dfad # v3",
            text,
        )


if __name__ == "__main__":
    unittest.main()
