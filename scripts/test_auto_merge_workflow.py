from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "auto-merge.yml"


class AutoMergeWorkflowContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text(encoding="utf-8")

    def test_privileged_workflow_never_checks_out_pr_head(self):
        self.assertIn("pull_request_target:", self.text)
        self.assertIn("ref: ${{ github.event.repository.default_branch }}", self.text)
        self.assertIn("persist-credentials: false", self.text)
        self.assertNotIn("github.event.pull_request.head.sha", self.text)
        self.assertNotIn("refs/pull/", self.text)

    def test_permissions_are_explicit_and_minimal_for_merge(self):
        self.assertIn("contents: write", self.text)
        self.assertIn("pull-requests: write", self.text)
        self.assertIn("checks: read", self.text)
        self.assertIn("issues: write", self.text)
        self.assertNotIn("actions: write", self.text)

    def test_concurrency_serializes_repository_wide_without_cancellation(self):
        self.assertIn(
            "group: fail-closed-auto-merge-${{ github.repository }}",
            self.text,
        )
        self.assertIn("cancel-in-progress: false", self.text)
        self.assertNotIn("github.run_id", self.text)

    def test_workflow_reacts_to_ci_native_and_review_completion(self):
        self.assertIn(
            'workflows: ["4VELO CI/CD Pipeline", "Mobile Native Smoke"]',
            self.text,
        )
        self.assertIn("check_run:", self.text)
        self.assertIn("Kilo Code Review", self.text)
        self.assertIn("Aggregate CI gate", self.text)
        self.assertIn("Android clean prebuild + debug compile", self.text)

    def test_workflow_supervises_stack_handoff_and_has_watchdog(self):
        self.assertIn(
            "types: [ready_for_review, reopened, synchronize, edited, closed]",
            self.text,
        )
        self.assertIn('cron: "*/30 * * * *"', self.text)
        for key in (
            "AUTOMATION_EVENT_NAME",
            "AUTOMATION_EVENT_ACTION",
            "AUTOMATION_PR_MERGED",
            "AUTOMATION_PR_NUMBER",
            "AUTOMATION_PR_HEAD_REF",
            "AUTOMATION_PR_BASE_REF",
        ):
            with self.subTest(key=key):
                self.assertIn(key, self.text)

    def test_workflow_executes_checked_in_policy(self):
        self.assertIn("python scripts/auto_merge.py", self.text)

    def test_workflow_does_not_use_external_project_secret(self):
        self.assertNotIn("PROJECTS_TOKEN", self.text)
        self.assertNotIn("secrets.", self.text)


if __name__ == "__main__":
    unittest.main()
