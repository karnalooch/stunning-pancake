"""Contract for cost-aware Mobile Windows Release Smoke routing."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "mobile-windows-release-smoke.yml"


def workflow_text() -> str:
    return WORKFLOW.read_text(encoding="utf-8")


class MobileWindowsReleaseSmokeWorkflowTests(unittest.TestCase):
    def test_pr_trigger_stays_visible_for_mobile_changes(self):
        text = workflow_text()
        self.assertIn('      - "mobile/**"', text)
        self.assertIn("  pull_request:", text)

    def test_scope_uses_canonical_change_classifier(self):
        text = workflow_text()
        self.assertIn("  native-scope:", text)
        self.assertIn("Classify native-affecting changes", text)
        self.assertIn("python scripts/plan_affected_tests.py", text)
        self.assertIn("steps.classifier.outputs.lane_mobile_native", text)
        self.assertIn("github.event.pull_request.base.sha", text)
        self.assertIn("github.event.pull_request.head.sha", text)

    def test_windows_release_compile_is_conditioned_on_native_scope(self):
        text = workflow_text()
        self.assertIn("    needs: [native-scope]", text)
        self.assertIn("    if: needs.native-scope.outputs.run == 'true'", text)
        self.assertIn("JS/UI/assets/backend-only PR; Windows release compile is redundant", text)
        self.assertIn("gradlew.bat assembleRelease --no-daemon --stacktrace --max-workers=2", text)

    def test_manual_run_still_forces_release_validation(self):
        text = workflow_text()
        self.assertIn('if [ "$EVENT_NAME" != "pull_request" ]; then', text)
        self.assertIn('echo "run=true" >> "$GITHUB_OUTPUT"', text)
        self.assertIn("workflow_dispatch:", text)

    def test_classifier_changes_revalidate_the_workflow(self):
        text = workflow_text()
        for path in (
            '      - "scripts/plan_affected_tests.py"',
            '      - "scripts/test_plan_affected_tests.py"',
            '      - "scripts/test_mobile_windows_release_smoke_workflow.py"',
        ):
            with self.subTest(path=path):
                self.assertIn(path, text)


if __name__ == "__main__":
    unittest.main()
