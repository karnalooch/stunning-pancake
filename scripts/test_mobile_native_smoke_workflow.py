"""Contract for cost-aware, fail-closed Mobile Native Smoke routing."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "mobile-native-smoke.yml"


def workflow_text() -> str:
    return WORKFLOW.read_text(encoding="utf-8")



class MobileNativeSmokeWorkflowTests(unittest.TestCase):
    def test_pr_trigger_stays_broad_so_smoke_check_is_visible(self):
        text = workflow_text()
        self.assertIn('      - "mobile/**"', text)
        self.assertIn("  pull_request:", text)

    def test_scope_uses_canonical_direct_native_classifier(self):
        text = workflow_text()
        self.assertIn("Classify direct native-affecting changes", text)
        self.assertIn("changed_files_from_git", text)
        self.assertIn("is_mobile_native_affecting_path", text)
        self.assertIn('release_orchestration = {".github/workflows/full-release.yml"}', text)
        self.assertIn("steps.classifier.outputs.direct_native_changed", text)
        self.assertIn("github.event.pull_request.base.sha", text)
        self.assertIn("github.event.pull_request.head.sha", text)
        self.assertNotIn("steps.classifier.outputs.lane_mobile_native", text)
        self.assertNotIn("dorny/paths-filter", text)

    def test_full_android_build_is_conditioned_on_scope_decision(self):
        text = workflow_text()
        self.assertIn("  native-scope:", text)
        self.assertIn("    needs: [native-scope]", text)
        self.assertIn("    if: needs.native-scope.outputs.run == 'true'", text)
        self.assertIn("pnpm exec expo prebuild --clean --platform android --no-install", text)
        self.assertIn("./gradlew assembleDebug --no-daemon --stacktrace", text)
        self.assertIn("./gradlew assembleRelease --no-daemon --stacktrace", text)
        self.assertLess(
            text.index("./gradlew assembleDebug --no-daemon --stacktrace"),
            text.index("./gradlew assembleRelease --no-daemon --stacktrace"),
        )

    def test_native_affecting_pr_builds_debug_and_release(self):
        text = workflow_text()
        self.assertIn("release: ${{ steps.decision.outputs.release }}", text)
        self.assertIn(
            "- name: Compile Android release APK\n        if: needs.native-scope.outputs.release == 'true'",
            text,
        )
        self.assertIn(
            "- name: Prepare exact-SHA runtime artifact\n        if: needs.native-scope.outputs.release == 'true'",
            text,
        )
        self.assertIn(
            "- name: Upload exact-SHA runtime artifact\n        if: needs.native-scope.outputs.release == 'true'",
            text,
        )
        self.assertIn("Native/release-affecting PRs prove both debug and release packaging.", text)
        self.assertIn("FORCE_RELEASE: ${{ inputs.release || false }}", text)
        self.assertIn('echo "release=true" >> "$GITHUB_OUTPUT"', text)
        self.assertIn("direct native/release-affecting PR paths changed", text)

    def test_unrelated_full_release_pr_can_skip_gradle(self):
        text = workflow_text()
        self.assertIn('echo "run=false" >> "$GITHUB_OUTPUT"', text)
        self.assertIn('echo "release=false" >> "$GITHUB_OUTPUT"', text)
        self.assertIn(
            "no direct native/release inputs changed; heavyweight Android build not required",
            text,
        )

    def test_full_build_publishes_exact_sha_release_artifact(self):
        text = workflow_text()
        for token in (
            "Prepare exact-SHA runtime artifact",
            "Upload exact-SHA runtime artifact",
            "mobile/android/app/build/outputs/apk/release/app-release.apk",
            "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
            "name: mobile-runtime-${{ github.run_id }}",
            '"sourceHeadSha"',
            '"builtGitSha"',
            '"workflowRunId"',
            '"apkSha256"',
        ):
            with self.subTest(token=token):
                self.assertIn(token, text)

    def test_non_pr_runs_force_native_smoke_and_workflow_is_reusable(self):
        text = workflow_text()
        self.assertIn('if [ "$EVENT_NAME" != "pull_request" ]; then', text)
        self.assertIn('echo "run=true" >> "$GITHUB_OUTPUT"', text)
        self.assertIn("  workflow_call:", text)
        self.assertIn("release:", text)
        self.assertNotIn('cron: "30 3 * * 1"', text)
        self.assertIn("    branches: [main]", text)

    def test_scope_detection_uses_read_only_contents_permission(self):
        text = workflow_text()
        self.assertIn("permissions:\n  contents: read", text)
        self.assertNotIn("pull-requests: read", text)


if __name__ == "__main__":
    unittest.main()
