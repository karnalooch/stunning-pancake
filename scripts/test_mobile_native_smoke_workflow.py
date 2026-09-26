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

    def test_scope_uses_canonical_change_classifier(self):
        text = workflow_text()
        self.assertIn("Classify native-affecting changes", text)
        self.assertIn("python scripts/plan_affected_tests.py", text)
        self.assertIn("steps.classifier.outputs.lane_mobile_native", text)
        self.assertIn("github.event.pull_request.base.sha", text)
        self.assertIn("github.event.pull_request.head.sha", text)
        self.assertNotIn("dorny/paths-filter", text)

    def test_full_android_build_is_conditioned_on_scope_decision(self):
        text = workflow_text()
        self.assertIn("  native-scope:", text)
        self.assertIn("    needs: [native-scope]", text)
        self.assertIn("    if: needs.native-scope.outputs.run == 'true'", text)
        self.assertIn("pnpm exec expo prebuild --clean --platform android --no-install", text)
        self.assertIn("./gradlew assembleDebug --no-daemon --stacktrace", text)

    def test_non_pr_runs_force_native_smoke_and_workflow_is_reusable(self):
        text = workflow_text()
        self.assertIn('if [ "$EVENT_NAME" != "pull_request" ]; then', text)
        self.assertIn('echo "run=true" >> "$GITHUB_OUTPUT"', text)
        self.assertIn("  workflow_call:", text)
        self.assertNotIn('cron: "30 3 * * 1"', text)
        self.assertIn("    branches: [main]", text)

    def test_scope_detection_uses_read_only_contents_permission(self):
        text = workflow_text()
        self.assertIn("permissions:\n  contents: read", text)
        self.assertNotIn("pull-requests: read", text)


if __name__ == "__main__":
    unittest.main()
