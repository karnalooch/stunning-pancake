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
        self.assertNotIn("actions: write", self.text)
        self.assertNotIn("issues: write", self.text)

    def test_concurrency_tracks_pr_across_all_event_shapes(self):
        self.assertIn("github.event.pull_request.number", self.text)
        self.assertIn("github.event.workflow_run.pull_requests[0].number", self.text)
        self.assertIn("github.event.check_run.pull_requests[0].number", self.text)
        self.assertIn("github.run_id", self.text)
        self.assertIn("github.event_name == 'pull_request_target'", self.text)
        self.assertIn("github.event_name == 'workflow_run'", self.text)
        self.assertIn("github.event_name == 'check_run'", self.text)
        self.assertNotIn("github.event_name == 'pull_request' }}", self.text)

    def test_workflow_reacts_to_ci_and_review_completion(self):
        self.assertIn(
            'workflows: ["4VELO CI/CD Pipeline", "Kubernetes Release Gate"]',
            self.text,
        )
        self.assertIn("check_run:", self.text)
        self.assertIn("Kilo Code Review", self.text)
        self.assertIn("Aggregate CI gate", self.text)

    def test_workflow_executes_checked_in_policy(self):
        self.assertIn("python scripts/auto_merge.py", self.text)

    def test_workflow_does_not_use_external_project_secret(self):
        self.assertNotIn("PROJECTS_TOKEN", self.text)
        self.assertNotIn("secrets.", self.text)


if __name__ == "__main__":
    unittest.main()
