import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "release" / "pre_release_check.py"
SPEC = importlib.util.spec_from_file_location("pre_release_check", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


def pass_manifest():
    return {
        "schema_version": 1,
        "evidence": {
            key: {"status": "PASS", "evidence": [f"proof/{key}.json"]}
            for key in gate.REQUIRED_PILOT_EVIDENCE
        },
    }


class PreReleaseCheckTests(unittest.TestCase):
    def test_all_pass_manifest_satisfies_pilot_evidence_contract(self):
        errors, blockers = gate.evaluate_pilot_evidence(pass_manifest())
        self.assertEqual(errors, [])
        self.assertEqual(blockers, [])

    def test_non_pass_status_fails_closed(self):
        document = pass_manifest()
        document["evidence"]["t68_signing_key_closure"]["status"] = "BLOCKED"
        errors, blockers = gate.evaluate_pilot_evidence(document)
        self.assertEqual(errors, [])
        self.assertIn("t68_signing_key_closure: BLOCKED", blockers)

    def test_missing_or_unreferenced_evidence_fails_closed(self):
        document = pass_manifest()
        del document["evidence"]["t76_android_chaos"]
        document["evidence"]["t84_physical_android_ui"]["evidence"] = []
        errors, blockers = gate.evaluate_pilot_evidence(document)
        self.assertIn("t76_android_chaos: missing evidence object", errors)
        self.assertIn(
            "t84_physical_android_ui: evidence must be a non-empty list of references",
            errors,
        )
        self.assertEqual(blockers, [])

    def test_report_is_secret_free_status_summary(self):
        document = pass_manifest()
        document["evidence"]["t85_tenant_admin_smoke"]["secret"] = "must-not-leak"
        with tempfile.TemporaryDirectory() as folder:
            report_path = Path(folder) / "report.json"
            report = gate.build_pilot_report(
                document,
                git_sha="a" * 40,
                manifest_path=Path("evidence.json"),
                errors=[],
                blockers=[],
            )
            gate.write_report(report, report_path)
            text = report_path.read_text(encoding="utf-8")
        self.assertIn('"result": "PASS"', text)
        self.assertNotIn("must-not-leak", text)

    def test_tracked_manifest_intentionally_reports_current_no_go(self):
        manifest = json.loads(
            (ROOT / "docs" / "security" / "PILOT_RELEASE_EVIDENCE.json").read_text(
                encoding="utf-8"
            )
        )
        errors, blockers = gate.evaluate_pilot_evidence(manifest)
        self.assertEqual(errors, [])
        self.assertEqual(
            set(blockers),
            {
                "t28_security_inventory: PLANNED",
                "t68_signing_key_closure: BLOCKED",
                "t76_android_chaos: PARTIAL",
                "t84_physical_android_ui: BLOCKED",
                "t85_tenant_admin_smoke: PARTIAL",
                "t86_global_owner_smoke: PARTIAL",
            },
        )

    def test_manual_t58_workflow_is_exact_sha_and_fail_closed(self):
        workflow = (ROOT / ".github" / "workflows" / "pilot-release-gate.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("candidate_sha:", workflow)
        self.assertIn("ref: ${{ inputs.candidate_sha }}", workflow)
        self.assertIn("EXPECTED_SHA: ${{ inputs.candidate_sha }}", workflow)
        self.assertIn('^[0-9a-fA-F]{40}$', workflow)
        self.assertIn("pre_release_check.py --pilot", workflow)
        self.assertIn("if: always()", workflow)
        self.assertIn("actions/upload-artifact@", workflow)


if __name__ == "__main__":
    unittest.main()
