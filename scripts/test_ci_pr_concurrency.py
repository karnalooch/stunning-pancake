"""Regression contract for PR workflow concurrency.

PR pushes should cancel stale workflow runs for the same PR. Non-PR events use
github.run_id in the group, so push/schedule/manual workflows are not silently
serialized or cancelled by this policy.
"""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
EXPECTED_GROUP = "${{ github.workflow }}-${{ github.event.pull_request.number || github.run_id }}"
EXPECTED_CANCEL = "${{ github.event_name == 'pull_request' }}"


class PullRequestWorkflowConcurrencyTests(unittest.TestCase):
    def test_every_pull_request_workflow_cancels_stale_pr_runs_only(self):
        pr_workflows = []
        for path in sorted(WORKFLOWS.glob("*.yml")):
            text = path.read_text(encoding="utf-8")
            if "pull_request:" not in text:
                continue
            pr_workflows.append(path.name)
            with self.subTest(workflow=path.name):
                self.assertIn("concurrency:", text)
                self.assertIn(f"group: {EXPECTED_GROUP}", text)
                self.assertIn(f"cancel-in-progress: {EXPECTED_CANCEL}", text)

        self.assertGreater(len(pr_workflows), 0)


if __name__ == "__main__":
    unittest.main()
