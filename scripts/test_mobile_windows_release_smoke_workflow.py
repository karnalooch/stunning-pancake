"""Contract for Gumball-routed Mobile Windows Release Smoke."""

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

    def test_pull_requests_never_compile_windows_apk_automatically(self):
        text = workflow_text()
        self.assertIn('if [ "$EVENT_NAME" != "pull_request" ]; then', text)
        self.assertIn(
            "Gumball defers Windows APK compilation to manual/release validation",
            text,
        )
        self.assertIn(
            "PR Windows release proof deferred by Gumball CI Cost Governor",
            text,
        )
        self.assertNotIn("native-affecting PR paths changed", text)

    def test_windows_release_compile_remains_scope_gated(self):
        text = workflow_text()
        self.assertIn("    needs: [native-scope]", text)
        self.assertIn("    if: needs.native-scope.outputs.run == 'true'", text)
        self.assertIn(
            "gradlew.bat assembleRelease --no-daemon --stacktrace --max-workers=2",
            text,
        )

    def test_manual_run_still_forces_release_validation(self):
        text = workflow_text()
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
