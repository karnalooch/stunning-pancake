"""4VELO consumer contract for Gumball v0.6 Proof Broker."""

from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest import mock

from scripts.ops import proof_broker
from scripts.ops.proof_broker import (
    BrokerError,
    resolve_proof_revision,
    validate_policy,
    validate_workflow_contract,
)

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
        self.assertEqual(["karnalooch"], policy["defaults"]["trusted_actor_logins"])

    def test_open_pr_proof_uses_exact_head_revision(self):
        sha = "a" * 40
        pr = {
            "state": "open",
            "head": {
                "ref": "feat/example",
                "sha": sha,
                "repo": {"full_name": "karnalooch/stunning-pancake"},
            },
            "base": {"ref": "main"},
            "merge_commit_sha": "b" * 40,
        }

        branch, resolved_sha = resolve_proof_revision(
            "karnalooch/stunning-pancake",
            pr,
            allow_merged=False,
        )

        self.assertEqual("feat/example", branch)
        self.assertEqual(sha, resolved_sha)

    def test_explicit_merged_pr_proof_uses_merge_commit_sha(self):
        sha = "c" * 40
        pr = {
            "state": "closed",
            "merged_at": "2026-09-30T17:30:00Z",
            "head": {
                "ref": "feat/example",
                "sha": "a" * 40,
                "repo": {"full_name": "karnalooch/stunning-pancake"},
            },
            "base": {"ref": "main"},
            "merge_commit_sha": sha,
        }

        branch, resolved_sha = resolve_proof_revision(
            "karnalooch/stunning-pancake",
            pr,
            allow_merged=True,
        )

        self.assertEqual("main", branch)
        self.assertEqual(sha, resolved_sha)

    def test_automatic_merged_pr_proof_remains_blocked(self):
        pr = {
            "state": "closed",
            "merged_at": "2026-09-30T17:30:00Z",
            "base": {"ref": "main"},
            "merge_commit_sha": "c" * 40,
        }

        with self.assertRaisesRegex(BrokerError, "explicit trusted request"):
            resolve_proof_revision(
                "karnalooch/stunning-pancake",
                pr,
                allow_merged=False,
            )

    def test_closed_unmerged_pr_proof_remains_blocked(self):
        pr = {
            "state": "closed",
            "merged_at": None,
            "base": {"ref": "main"},
            "merge_commit_sha": None,
        }

        with self.assertRaisesRegex(BrokerError, "closed-unmerged"):
            resolve_proof_revision(
                "karnalooch/stunning-pancake",
                pr,
                allow_merged=True,
            )

    def test_post_dispatch_status_bookkeeping_failure_preserves_dispatch(self):
        policy = json.loads(POLICY.read_text(encoding="utf-8"))
        merged_sha = "d" * 40
        pr = {
            "state": "closed",
            "merged_at": "2026-09-30T18:30:00Z",
            "base": {"ref": "main"},
            "merge_commit_sha": merged_sha,
        }
        error = proof_broker.github_ops.GitHubError(
            "PUT /repos/karnalooch/stunning-pancake/issues/411/labels: HTTP 403: forbidden"
        )

        with (
            mock.patch.object(proof_broker, "get_pr", return_value=pr),
            mock.patch.object(proof_broker, "find_existing_run", return_value=None),
            mock.patch.object(
                proof_broker,
                "get_pr_paths",
                return_value=["mobile/src/screens/RideScreen.tsx"],
            ),
            mock.patch.object(proof_broker, "default_branch", return_value="main"),
            mock.patch.object(
                proof_broker,
                "fetch_workflow_text",
                return_value=NATIVE.read_text(encoding="utf-8"),
            ),
            mock.patch.object(proof_broker, "dispatch_workflow") as dispatch,
            mock.patch.object(
                proof_broker,
                "set_status_label",
                side_effect=error,
            ),
        ):
            result = proof_broker.evaluate_proof(
                repo="karnalooch/stunning-pancake",
                token="token",
                policy=policy,
                proof_id="android-native-release",
                pr_number=411,
                actor="karnalooch",
                explicit=True,
                retry=False,
                status_only=False,
                apply=True,
            )

        self.assertEqual("DISPATCH", result["action"])
        self.assertEqual(merged_sha, result["sha"])
        self.assertIn("post-dispatch status bookkeeping failed", result["warning"])
        dispatch.assert_called_once()

    def test_result_comment_bookkeeping_failure_is_warning(self):
        result = {
            "action": "DISPATCH",
            "proof": "android-native-release",
            "pr_number": 411,
            "request_id": "gb-android-native-release-pr411-deb8833fc78a",
        }
        error = proof_broker.github_ops.GitHubError(
            "POST /repos/karnalooch/stunning-pancake/issues/411/comments: HTTP 403: forbidden"
        )
        with mock.patch.object(
            proof_broker,
            "comment_result",
            side_effect=error,
        ):
            warning = proof_broker.comment_result_best_effort(
                "karnalooch/stunning-pancake",
                "token",
                411,
                result,
                True,
            )

        self.assertIsNotNone(warning)
        self.assertIn("result comment bookkeeping failed", warning)
        self.assertIn("DISPATCH", warning)

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
