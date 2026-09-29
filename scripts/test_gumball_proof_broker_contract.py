"""4VELO consumer contract for Gumball v0.6 Proof Broker."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from scripts.ops.proof_broker import validate_policy, validate_workflow_contract

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / ".gumball" / "proof-broker.json"
NATIVE = ROOT / ".github" / "workflows" / "mobile-native-smoke.yml"
FULL_RELEASE = ROOT / ".github" / "workflows" / "full-release.yml"


class GumballProofBrokerContractTests(unittest.TestCase):
    def test_consumer_policy_is_valid(self):
        policy = json.loads(POLICY.read_text(encoding="utf-8"))
        self.assertEqual([], validate_policy(policy))
        proof = policy["proofs"]["android-native-release"]
        self.assertTrue(proof["enabled"])
        self.assertEqual("heavy", proof["cost_class"])
        self.assertFalse(proof["merge_critical"])
        self.assertFalse(proof["automatic"]["enabled"])
        self.assertEqual("$sha", proof["inputs"]["source_sha"])
        self.assertEqual("$request_id", proof["inputs"]["gumball_request_id"])

    def test_native_workflow_satisfies_trusted_dispatch_contract(self):
        policy = json.loads(POLICY.read_text(encoding="utf-8"))
        proof = policy["proofs"]["android-native-release"]
        problems = validate_workflow_contract(
            NATIVE.read_text(encoding="utf-8"),
            proof,
        )
        self.assertEqual([], problems)

    def test_full_release_defers_android_only_for_pull_requests(self):
        text = FULL_RELEASE.read_text(encoding="utf-8")
        self.assertIn("if: github.event_name != 'pull_request'", text)
        self.assertIn(
            'if [ "$EVENT_NAME" = "pull_request" ]; then',
            text,
        )
        self.assertIn(
            "Full Android native smoke expected skipped on pull_request",
            text,
        )
        self.assertIn(
            'check "Full Android native smoke" "$ANDROID_NATIVE"',
            text,
        )

    def test_broker_workflow_runs_trusted_default_branch_code(self):
        text = (ROOT / ".github" / "workflows" / "proof-broker.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("pull_request_target:", text)
        self.assertIn("Checkout trusted default branch", text)
        self.assertIn("ref: ${{ github.event.repository.default_branch }}", text)
        self.assertIn("actions: write", text)
        self.assertIn("persist-credentials: false", text)


if __name__ == "__main__":
    unittest.main()
