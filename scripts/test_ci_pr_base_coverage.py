"""Contract for CI coverage of stacked pull requests."""

from __future__ import annotations

import unittest
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
WORKFLOW = REPO / ".github" / "workflows" / "ci.yml"


def _on(workflow: dict) -> dict:
    return workflow.get(True, workflow.get("on", {}))


class CIStackedPullRequestCoverageTests(unittest.TestCase):
    def test_pull_request_trigger_has_no_base_branch_filter(self):
        workflow = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        pull_request = _on(workflow).get("pull_request")

        self.assertIsInstance(
            pull_request,
            dict,
            "pull_request trigger must be an explicit mapping",
        )
        self.assertNotIn(
            "branches",
            pull_request,
            "main CI must run for stacked PRs whose base is another feature branch",
        )


if __name__ == "__main__":
    unittest.main()
