import json
import tempfile
import unittest
from pathlib import Path

import t92_regression


class T92RegressionTests(unittest.TestCase):
    def test_candidate_sha_requires_full_lowercase_hex(self):
        good = "a" * 40
        self.assertEqual(t92_regression.validate_candidate_sha(good), good)
        for value in (
            "",
            "a" * 39,
            "a" * 41,
            "A" * 40,
            "g" * 40,
            "main",
        ):
            with self.subTest(value=value), self.assertRaises(t92_regression.T92Error):
                t92_regression.validate_candidate_sha(value)

    def test_evidence_passes_only_when_every_required_lane_succeeds(self):
        evidence = t92_regression.build_evidence(
            candidate_sha="b" * 40,
            workflow_run_id="123",
            repository="karnalooch/stunning-pancake",
            lane_results={
                "preflight": "success",
                "exact_regression": "success",
                "full_release": "success",
            },
        )
        self.assertEqual(evidence["overall_status"], "PASS")
        self.assertFalse(evidence["t94_selective_execution_used"])
        self.assertFalse(evidence["deployment_performed"])

        failed = t92_regression.build_evidence(
            candidate_sha="b" * 40,
            workflow_run_id="123",
            repository="karnalooch/stunning-pancake",
            lane_results={
                "preflight": "success",
                "exact_regression": "failure",
                "full_release": "success",
            },
        )
        self.assertEqual(failed["overall_status"], "FAIL")

    def test_missing_lane_is_rejected(self):
        with self.assertRaises(t92_regression.T92Error):
            t92_regression.build_evidence(
                candidate_sha="c" * 40,
                workflow_run_id="123",
                repository="repo",
                lane_results={
                    "preflight": "success",
                    "full_release": "success",
                },
            )

    def test_written_evidence_is_secret_free_and_commit_bound(self):
        evidence = t92_regression.build_evidence(
            candidate_sha="d" * 40,
            workflow_run_id="987",
            repository="owner/repo",
            lane_results={
                "preflight": "success",
                "exact_regression": "success",
                "full_release": "success",
            },
        )
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "t92.json"
            t92_regression.write_evidence(path, evidence)
            stored = json.loads(path.read_text(encoding="utf-8"))

        self.assertEqual(stored["candidate_sha"], "d" * 40)
        self.assertEqual(stored["workflow_run_id"], "987")
        self.assertEqual(stored["overall_status"], "PASS")
        serialized = json.dumps(stored)
        self.assertNotIn("password", serialized.lower())
        self.assertNotIn("token", serialized.lower())
        self.assertNotIn("secret", serialized.lower())


if __name__ == "__main__":
    unittest.main()
