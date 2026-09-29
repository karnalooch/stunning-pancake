"""Contract for Gumball-routed Mobile Native Smoke."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "mobile-native-smoke.yml"


def workflow_text() -> str:
    return WORKFLOW.read_text(encoding="utf-8")


class MobileNativeSmokeWorkflowTests(unittest.TestCase):
    def test_pr_trigger_stays_visible_but_heavy_job_is_scope_gated(self):
        text = workflow_text()
        self.assertIn('      - "mobile/**"', text)
        self.assertIn("  pull_request:", text)
        self.assertIn("  native-scope:", text)
        self.assertIn("    needs: [native-scope]", text)
        self.assertIn("    if: needs.native-scope.outputs.run == 'true'", text)

    def test_scope_uses_canonical_direct_native_classifier(self):
        text = workflow_text()
        self.assertIn("Classify direct native-affecting changes", text)
        self.assertIn("changed_files_from_git", text)
        self.assertIn("is_mobile_native_affecting_path", text)
        self.assertIn("steps.classifier.outputs.direct_native_changed", text)
        self.assertNotIn("dorny/paths-filter", text)

    def test_pull_requests_never_compile_apk_automatically(self):
        text = workflow_text()
        self.assertIn('elif [ "$EVENT_NAME" != "pull_request" ]; then', text)
        self.assertIn(
            "Gumball defers APK compilation to explicit /gumball proof android-native-release",
            text,
        )
        self.assertIn(
            "PR Android proof deferred by Gumball CI Cost Governor",
            text,
        )
        self.assertNotIn("direct native/release-affecting PR paths changed", text)

    def test_broker_dispatch_has_exact_sha_and_request_id_inputs(self):
        text = workflow_text()
        self.assertIn("run-name: Mobile Native Smoke ${{ inputs.gumball_request_id", text)
        self.assertIn("  workflow_dispatch:", text)
        self.assertIn("      source_sha:", text)
        self.assertIn("      gumball_request_id:", text)
        self.assertIn(
            "inputs.source_sha || github.event.pull_request.head.sha || github.sha",
            text,
        )
        self.assertIn("FORCE_RELEASE: ${{ inputs.release || false }}", text)

    def test_explicit_non_pr_runs_can_force_native_release_proof(self):
        text = workflow_text()
        self.assertIn('if [ "$FORCE_RELEASE" = "true" ]; then', text)
        self.assertIn('echo "run=true" >> "$GITHUB_OUTPUT"', text)
        self.assertIn('echo "release=true" >> "$GITHUB_OUTPUT"', text)
        self.assertIn("  workflow_call:", text)
        self.assertIn("  workflow_dispatch:", text)

    def test_main_push_never_triggers_mobile_native_smoke(self):
        text = workflow_text()
        self.assertNotIn("\n  push:\n    branches: [main]\n", text)

    def test_full_build_still_proves_exact_sha_and_artifact(self):
        text = workflow_text()
        for token in (
            "Assert exact source checkout",
            "pnpm exec expo prebuild --clean --platform android --no-install",
            "./gradlew assembleDebug --no-daemon --stacktrace",
            "./gradlew assembleRelease --no-daemon --stacktrace",
            "Prepare exact-SHA runtime artifact",
            "Upload exact-SHA runtime artifact",
            '"sourceHeadSha"',
            '"builtGitSha"',
            '"apkSha256"',
        ):
            with self.subTest(token=token):
                self.assertIn(token, text)

    def test_scope_detection_keeps_read_only_contents_permission(self):
        text = workflow_text()
        self.assertIn("permissions:\n  contents: read", text)
        self.assertNotIn("permissions: write-all", text)


if __name__ == "__main__":
    unittest.main()
