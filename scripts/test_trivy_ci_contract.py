"""Contract tests for the Trivy CI reporting and enforcement policy."""

from __future__ import annotations

import unittest
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "ci.yml"


def _trivy_block() -> str:
    text = WORKFLOW.read_text(encoding="utf-8")
    start = text.index("  trivy:\n")
    end = text.index("\n  # ──────────────────────────────────────────\n  # E2E:", start)
    return text[start:end]


class TrivyCIContractTests(unittest.TestCase):
    SARIF_STEPS = (
        "Trivy — Backend (Python)",
        "Trivy — Admin Dashboard (JS/TS)",
        "Trivy — Mobile (React Native)",
    )

    @staticmethod
    def _step(block: str, name: str, next_name: str | None = None) -> str:
        start = block.index(f"      - name: {name}\n")
        if next_name is None:
            return block[start:]
        end = block.index(f"      - name: {next_name}\n", start)
        return block[start:end]

    def test_reporting_scans_are_vulnerability_only_and_high_critical_only(self):
        block = _trivy_block()
        boundaries = (
            ("Trivy — Backend (Python)", "Trivy — Admin Dashboard (JS/TS)"),
            ("Trivy — Admin Dashboard (JS/TS)", "Trivy — Mobile (React Native)"),
            ("Trivy — Mobile (React Native)", "Upload backend SARIF → GitHub Security"),
        )
        for name, next_name in boundaries:
            with self.subTest(step=name):
                step = self._step(block, name, next_name)
                self.assertIn("scanners: vuln", step)
                self.assertIn("format: sarif", step)
                self.assertIn("severity: CRITICAL,HIGH", step)
                self.assertIn("limit-severities-for-sarif: true", step)
                self.assertIn("exit-code: '0'", step)

    def test_all_sarif_uploads_happen_before_blocking_gate(self):
        block = _trivy_block()
        gate_pos = block.index("      - name: Trivy — Blocking Critical/High gate\n")
        for upload in (
            "Upload backend SARIF → GitHub Security",
            "Upload admin SARIF → GitHub Security",
            "Upload mobile SARIF → GitHub Security",
        ):
            with self.subTest(upload=upload):
                self.assertLess(block.index(f"      - name: {upload}\n"), gate_pos)

    def test_blocking_gate_fails_on_high_or_critical_vulnerabilities(self):
        block = _trivy_block()
        gate = self._step(block, "Trivy — Blocking Critical/High gate")
        self.assertIn("scan-type: fs", gate)
        self.assertIn("scan-ref: .", gate)
        self.assertIn("scanners: vuln", gate)
        self.assertIn("severity: CRITICAL,HIGH", gate)
        self.assertIn("exit-code: '1'", gate)
        self.assertNotIn("continue-on-error", gate)
        self.assertNotIn("format: sarif", gate)

    def test_reporting_sarif_is_filtered_not_all_severities(self):
        block = _trivy_block()
        self.assertEqual(block.count("limit-severities-for-sarif: true"), 3)
        self.assertEqual(block.count("scanners: vuln"), 4)


if __name__ == "__main__":
    unittest.main()
