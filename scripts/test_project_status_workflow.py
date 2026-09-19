from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = ROOT / ".github" / "workflows" / "project-status.yml"


class ProjectStatusWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text(encoding="utf-8")

    def test_uses_pull_request_not_pull_request_target(self):
        self.assertIn("pull_request:", self.text)
        self.assertNotIn("pull_request_target:", self.text)
        self.assertIn("opened", self.text)
        self.assertIn("reopened", self.text)
        self.assertIn("converted_to_draft", self.text)
        self.assertIn("ready_for_review", self.text)

    def test_fork_prs_do_not_receive_project_secret(self):
        self.assertIn(
            "github.event.pull_request.head.repo.full_name == github.repository",
            self.text,
        )

    def test_token_is_secret_backed_and_permissions_are_read_only(self):
        self.assertIn("secrets.PROJECTS_TOKEN", self.text)
        self.assertIn("permissions:\n  contents: read", self.text)
        self.assertNotIn("permissions:\n  contents: write", self.text)

    def test_workflow_calls_checked_in_automation_script(self):
        self.assertIn("python scripts/project_status_automation.py", self.text)


if __name__ == "__main__":
    unittest.main()
