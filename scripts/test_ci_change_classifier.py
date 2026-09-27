"""Structural contract for lane-based 4VELO CI change classification."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "ci.yml"


def text() -> str:
    return WORKFLOW.read_text(encoding="utf-8")


def job_block(name: str) -> str:
    raw = text()
    match = re.search(
        rf"(?ms)^  {re.escape(name)}:\n(?P<body>.*?)(?=^  [a-zA-Z0-9_-]+:\n)",
        raw,
    )
    if not match:
        raise AssertionError(f"job {name!r} not found")
    return match.group("body")


class ChangeClassifierWorkflowTests(unittest.TestCase):
    def test_changes_job_exports_classifier_owned_runtime_outputs(self):
        raw = text()
        self.assertIn(
            "mobile: ${{ steps.classifier.outputs.lane_mobile_runtime }}",
            raw,
        )
        self.assertIn(
            "visual: ${{ steps.classifier.outputs.visual_contract_required }}",
            raw,
        )
        for output in (
            "lane_mobile_assets",
            "lane_mobile_asset_only",
            "lane_mobile_native",
            "lane_python",
            "lane_javascript",
            "lane_docs_policy",
            "lane_infra",
            "lane_full_release",
        ):
            with self.subTest(output=output):
                self.assertIn(f"steps.classifier.outputs.{output}", raw)

    def test_classifier_uses_trusted_pr_base_and_full_history(self):
        block = job_block("changes")
        self.assertIn("fetch-depth: 0", block)
        self.assertIn("python scripts/plan_affected_tests.py", block)
        self.assertIn("CI_BASE_SHA:", block)
        self.assertIn("github.event.pull_request.base.sha", block)
        self.assertIn("CI_HEAD_SHA:", block)

    def test_python_and_javascript_codeql_are_separate_lanes(self):
        python = job_block("codeql-python")
        javascript = job_block("codeql-javascript")
        gate = job_block("codeql")

        self.assertIn("lane_python == 'true'", python)
        self.assertIn("languages: python", python)
        self.assertNotIn("javascript-typescript", python)

        self.assertIn("lane_javascript == 'true'", javascript)
        self.assertIn("languages: javascript-typescript", javascript)
        self.assertNotIn("languages: python", javascript)

        self.assertIn("needs: [changes, codeql-python, codeql-javascript]", gate)
        self.assertIn("Enforce language-specific CodeQL lanes", gate)

    def test_asset_only_visual_lane_skips_heavy_mobile_steps(self):
        visual = job_block("mobile-visual-contract")
        self.assertIn(
            "if: needs.changes.outputs.mobile_asset_only == 'true'",
            visual,
        )
        self.assertIn(
            "if: needs.changes.outputs.mobile_asset_only != 'true'",
            visual,
        )
        self.assertIn("__tests__/assets/assetGovernance.test.ts", visual)

    def test_mobile_filter_no_longer_matches_all_mobile_files(self):
        raw = text()
        filters = raw[raw.index("          filters: |") : raw.index("      - name: Classify CI lanes")]
        mobile = filters[filters.index("            mobile:") : filters.index("            admin:")]
        self.assertNotIn("'mobile/**'", mobile)
        self.assertIn("'mobile/src/**'", mobile)
        self.assertNotIn("'mobile/assets/**'", mobile)

    def test_asset_only_does_not_enter_scripts_lane(self):
        raw = text()
        filters = raw[raw.index("          filters: |") : raw.index("      - name: Classify CI lanes")]
        scripts = filters[filters.index("            scripts:") : filters.index("            docs:")]
        self.assertNotIn("'assets/**'", scripts)


if __name__ == "__main__":
    unittest.main()
