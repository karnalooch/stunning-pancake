from __future__ import annotations

import unittest
from unittest.mock import patch

from scripts.auto_merge import (
    AutomationError,
    auto_merge_mode,
    evaluate_eligible_pull_requests,
    evaluate_pull_request,
    has_changes_requested,
    is_native_affecting_path,
    is_risky_path,
    latest_check_conclusions,
    missing_required_checks,
    required_checks_for_paths,
    retarget_stacked_children,
    risky_paths,
)


class AutoMergePolicyTests(unittest.TestCase):
    def test_marker_is_explicit_and_manual_wins(self):
        self.assertEqual(auto_merge_mode("Auto-merge: eligible"), "eligible")
        self.assertEqual(
            auto_merge_mode("Auto-merge: eligible\nAuto-merge: manual"),
            "manual",
        )
        self.assertEqual(auto_merge_mode("looks safe"), None)

    def test_high_risk_paths_fail_closed(self):
        paths = [
            ".github/workflows/ci.yml",
            ".github/actions/pnpm-setup/action.yml",
            "scripts/versioning.py",
            "k8s/base/deployment.yaml",
            "docker-compose.prod.yml",
            "backend/users/migrations/0001_initial.py",
            "backend/auth/service.py",
            "package.json",
            "backend/package.json",
            "pnpm-lock.yaml",
            "backend/requirements.txt",
            "backend/requirements-dev.in",
            "AGENTS.md",
        ]
        for path in paths:
            with self.subTest(path=path):
                self.assertTrue(is_risky_path(path))

    def test_normal_product_and_docs_paths_can_be_low_risk(self):
        paths = [
            "mobile/src/screens/HomeScreen.tsx",
            "mobile/src/components/product/ProductCard.tsx",
            "backend/activities/services.py",
            "admin/src/features/map/MapView.tsx",
            "docs/design/MOBILE_UI_DESIGN_CONTRACT_V1.md",
            "docs/requirements-overview.md",
            "backend/requirements-helper.py",
            "notes/dependabot-config.md",
        ]
        for path in paths:
            with self.subTest(path=path):
                self.assertFalse(is_risky_path(path))

    def test_risky_paths_returns_only_blocked_files(self):
        self.assertEqual(
            risky_paths(
                [
                    "mobile/src/App.tsx",
                    ".github/workflows/ci.yml",
                    "backend/users/migrations/0002.py",
                ]
            ),
            [
                ".github/workflows/ci.yml",
                "backend/users/migrations/0002.py",
            ],
        )

    def test_native_paths_are_classified_conservatively(self):
        native_paths = (
            "mobile/app.config.js",
            "mobile/assets/icon.png",
            "mobile/android/app/src/main/AndroidManifest.xml",
            "mobile/plugins/withSomething.js",
            "pnpm-lock.yaml",
        )
        for path in native_paths:
            with self.subTest(path=path):
                self.assertTrue(is_native_affecting_path(path))

        for path in (
            "mobile/src/screens/HomeScreen.tsx",
            "mobile/__tests__/screens/HomeScreen.test.tsx",
            "mobile/assets/approved/home_hero_day_v1.jpg",
            "docs/design/MOBILE_UI_DESIGN_CONTRACT_V1.md",
        ):
            with self.subTest(path=path):
                self.assertFalse(is_native_affecting_path(path))

    def test_native_affecting_low_risk_change_requires_android_compile(self):
        required = required_checks_for_paths(["mobile/assets/icon.png"])
        self.assertIn("Aggregate CI gate", required)
        self.assertIn("Kilo Code Review", required)
        self.assertIn("Android clean prebuild + debug compile", required)

        missing = missing_required_checks(
            [
                {"id": 1, "name": "Aggregate CI gate", "conclusion": "success"},
                {"id": 2, "name": "Kilo Code Review", "conclusion": "success"},
            ],
            required,
        )
        self.assertEqual(missing, ["Android clean prebuild + debug compile"])

    def test_js_ui_change_does_not_require_android_compile(self):
        required = required_checks_for_paths(["mobile/src/screens/HomeScreen.tsx"])
        self.assertNotIn("Android clean prebuild + debug compile", required)

    def test_latest_check_run_wins_by_id(self):
        conclusions = latest_check_conclusions(
            [
                {"id": 10, "name": "Aggregate CI gate", "conclusion": "failure"},
                {"id": 11, "name": "Aggregate CI gate", "conclusion": "success"},
                {"id": 12, "name": "Kilo Code Review", "conclusion": "success"},
            ]
        )
        self.assertEqual(conclusions["Aggregate CI gate"], "success")
        self.assertEqual(conclusions["Kilo Code Review"], "success")
        self.assertEqual(
            missing_required_checks(
                [
                    {"id": 11, "name": "Aggregate CI gate", "conclusion": "success"},
                    {"id": 12, "name": "Kilo Code Review", "conclusion": "success"},
                ]
            ),
            [],
        )

    def test_missing_or_failed_required_check_blocks(self):
        self.assertEqual(
            missing_required_checks(
                [{"id": 1, "name": "Aggregate CI gate", "conclusion": "success"}]
            ),
            ["Kilo Code Review"],
        )
        self.assertEqual(
            missing_required_checks(
                [
                    {"id": 1, "name": "Aggregate CI gate", "conclusion": "success"},
                    {"id": 2, "name": "Kilo Code Review", "conclusion": "failure"},
                ]
            ),
            ["Kilo Code Review"],
        )

    def test_check_run_without_id_fails_closed(self):
        with self.assertRaisesRegex(AutomationError, "missing id"):
            missing_required_checks(
                [
                    {
                        "name": "Aggregate CI gate",
                        "conclusion": "success",
                    },
                    {
                        "id": 2,
                        "name": "Kilo Code Review",
                        "conclusion": "success",
                    },
                ]
            )

    def test_latest_changes_requested_review_blocks(self):
        self.assertTrue(
            has_changes_requested(
                [
                    {
                        "id": 1,
                        "state": "APPROVED",
                        "user": {"login": "reviewer"},
                    },
                    {
                        "id": 2,
                        "state": "CHANGES_REQUESTED",
                        "user": {"login": "reviewer"},
                    },
                ]
            )
        )
        self.assertFalse(
            has_changes_requested(
                [
                    {
                        "id": 1,
                        "state": "CHANGES_REQUESTED",
                        "user": {"login": "reviewer"},
                    },
                    {
                        "id": 2,
                        "state": "APPROVED",
                        "user": {"login": "reviewer"},
                    },
                ]
            )
        )


class AutoMergeBatchTests(unittest.TestCase):
    @patch("scripts.auto_merge.evaluate_pull_request")
    def test_one_pr_error_does_not_starve_later_prs(self, evaluate):
        evaluate.side_effect = [AutomationError("transient failure"), "merged"]

        result = evaluate_eligible_pull_requests(
            object(),
            repository="karnalooch/stunning-pancake",
            repository_owner="karnalooch",
            pull_requests=[
                {"number": 41, "body": "Auto-merge: eligible"},
                {"number": 42, "body": "Auto-merge: eligible"},
            ],
        )

        self.assertEqual(result, 1)
        self.assertEqual(evaluate.call_count, 2)


class StackRetargetApi:
    def __init__(self):
        self.calls = []

    def rest(self, method, path, payload=None, *, query=None):
        self.calls.append((method, path, payload, query))
        if method == "PATCH" and path.endswith("/pulls/278"):
            return (
                {
                    "number": 278,
                    "base": {"ref": payload["base"]},
                },
                {},
            )
        raise AssertionError(f"unexpected REST call: {method} {path}")


class AutoMergeStackLifecycleTests(unittest.TestCase):
    def test_merged_parent_retargets_direct_child_to_main(self):
        api = StackRetargetApi()
        result = retarget_stacked_children(
            api,
            repository="karnalooch/stunning-pancake",
            repository_owner="karnalooch",
            pull_requests=[
                {
                    "number": 278,
                    "base": {"ref": "assets/mobile-ui-v1"},
                    "head": {
                        "repo": {"full_name": "karnalooch/stunning-pancake"},
                    },
                    "user": {"login": "karnalooch"},
                    "body": "Auto-merge: manual",
                }
            ],
            merged_parent_number="277",
            merged_head_ref="assets/mobile-ui-v1",
            merged_base_ref="main",
        )
        self.assertEqual(result, 1)
        self.assertEqual(
            api.calls,
            [
                (
                    "PATCH",
                    "/repos/karnalooch/stunning-pancake/pulls/278",
                    {"base": "main"},
                    None,
                )
            ],
        )

    def test_retarget_skips_fork_or_non_owner_child(self):
        api = StackRetargetApi()
        result = retarget_stacked_children(
            api,
            repository="karnalooch/stunning-pancake",
            repository_owner="karnalooch",
            pull_requests=[
                {
                    "number": 278,
                    "base": {"ref": "assets/mobile-ui-v1"},
                    "head": {"repo": {"full_name": "someone/fork"}},
                    "user": {"login": "someone"},
                }
            ],
            merged_parent_number="277",
            merged_head_ref="assets/mobile-ui-v1",
            merged_base_ref="main",
        )
        self.assertEqual(result, 0)
        self.assertEqual(api.calls, [])

    def test_non_main_parent_merge_is_not_retargeted(self):
        api = StackRetargetApi()
        result = retarget_stacked_children(
            api,
            repository="karnalooch/stunning-pancake",
            repository_owner="karnalooch",
            pull_requests=[],
            merged_parent_number="277",
            merged_head_ref="assets/mobile-ui-v1",
            merged_base_ref="release",
        )
        self.assertEqual(result, 0)
        self.assertEqual(api.calls, [])


class FakeApi:
    def __init__(
        self,
        *,
        paths=None,
        checks=None,
        reviews=None,
        unresolved=0,
        mergeable_state="clean",
        author="karnalooch",
        head_repo="karnalooch/stunning-pancake",
    ):
        self.paths = paths or ["mobile/src/screens/HomeScreen.tsx"]
        self.checks = checks or [
            {"id": 10, "name": "Aggregate CI gate", "conclusion": "success"},
            {"id": 11, "name": "Kilo Code Review", "conclusion": "success"},
        ]
        self.reviews = reviews or []
        self.unresolved = unresolved
        self.closing_issues = [141]
        self.issue_state_reason = "completed"
        self.mergeable_state = mergeable_state
        self.author = author
        self.head_repo = head_repo
        self.calls = []

    def rest(self, method, path, payload=None, *, query=None):
        self.calls.append((method, path, payload, query))
        if method == "GET" and path.endswith("/pulls/42"):
            return (
                {
                    "number": 42,
                    "body": "Auto-merge: eligible",
                    "state": "open",
                    "draft": False,
                    "base": {"ref": "main"},
                    "head": {
                        "sha": "abc123",
                        "repo": {"full_name": self.head_repo},
                    },
                    "user": {"login": self.author},
                    "mergeable": True,
                    "mergeable_state": self.mergeable_state,
                    "title": "safe change",
                },
                {},
            )
        if method == "GET" and path.endswith("/pulls/42/files"):
            return ([{"filename": value} for value in self.paths], {})
        if method == "GET" and path.endswith("/commits/abc123/check-runs"):
            return (
                {"total_count": len(self.checks), "check_runs": self.checks},
                {},
            )
        if method == "GET" and path.endswith("/pulls/42/reviews"):
            return (self.reviews, {})
        if method == "PUT" and path.endswith("/pulls/42/update-branch"):
            return ({"message": "Updating pull request branch."}, {})
        if method == "PUT" and path.endswith("/pulls/42/merge"):
            return ({"merged": True, "sha": "merged-sha"}, {})
        if method == "PATCH" and path.endswith("/issues/141"):
            return (
                {
                    "number": 141,
                    "state": "closed",
                    "state_reason": self.issue_state_reason,
                },
                {},
            )
        raise AssertionError(f"unexpected REST call: {method} {path}")

    def graphql(self, query, variables):
        del query, variables
        return {
            "repository": {
                "pullRequest": {
                    "reviewThreads": {
                        "pageInfo": {"hasNextPage": False},
                        "nodes": [
                            {"isResolved": False} for _ in range(self.unresolved)
                        ],
                    },
                    "closingIssuesReferences": {
                        "pageInfo": {"hasNextPage": False},
                        "nodes": [
                            {
                                "number": issue_number,
                                "repository": {
                                    "nameWithOwner": "karnalooch/stunning-pancake"
                                },
                            }
                            for issue_number in self.closing_issues
                        ],
                    },
                }
            }
        }

    def put_paths(self):
        return [
            path
            for method, path, _payload, _query in self.calls
            if method == "PUT"
        ]


class AutoMergeDecisionTests(unittest.TestCase):
    def _evaluate(self, api):
        return evaluate_pull_request(
            api,
            repository="karnalooch/stunning-pancake",
            repository_owner="karnalooch",
            pr_summary={"number": 42, "body": "Auto-merge: eligible"},
        )

    def test_safe_green_pr_is_squash_merged(self):
        api = FakeApi()
        self.assertEqual(self._evaluate(api), "merged")
        self.assertEqual(
            api.put_paths(),
            ["/repos/karnalooch/stunning-pancake/pulls/42/merge"],
        )

    def test_missing_same_repo_closing_issue_blocks(self):
        api = FakeApi()
        api.closing_issues = []
        self.assertEqual(self._evaluate(api), "blocked")
        self.assertEqual(api.put_paths(), [])

    def test_successful_merge_closes_linked_issue(self):
        api = FakeApi()
        self.assertEqual(self._evaluate(api), "merged")
        patch_calls = [
            (path, payload)
            for method, path, payload, _query in api.calls
            if method == "PATCH"
        ]
        self.assertEqual(
            patch_calls,
            [
                (
                    "/repos/karnalooch/stunning-pancake/issues/141",
                    {"state": "closed", "state_reason": "completed"},
                )
            ],
        )

    def test_wrong_issue_state_reason_fails_visibly_after_merge(self):
        api = FakeApi()
        api.issue_state_reason = "not_planned"
        with self.assertRaisesRegex(AutomationError, "did not close as completed"):
            self._evaluate(api)

    def test_high_risk_path_never_reaches_merge(self):
        api = FakeApi(paths=[".github/workflows/ci.yml"])
        self.assertEqual(self._evaluate(api), "blocked")
        self.assertEqual(api.put_paths(), [])

    def test_missing_review_check_never_reaches_merge(self):
        api = FakeApi(
            checks=[
                {"id": 10, "name": "Aggregate CI gate", "conclusion": "success"}
            ]
        )
        self.assertEqual(self._evaluate(api), "blocked")
        self.assertEqual(api.put_paths(), [])

    def test_unresolved_thread_never_reaches_merge(self):
        api = FakeApi(unresolved=1)
        self.assertEqual(self._evaluate(api), "blocked")
        self.assertEqual(api.put_paths(), [])

    def test_changes_requested_never_reaches_merge(self):
        api = FakeApi(
            reviews=[
                {
                    "id": 20,
                    "state": "CHANGES_REQUESTED",
                    "user": {"login": "human-reviewer"},
                }
            ]
        )
        self.assertEqual(self._evaluate(api), "blocked")
        self.assertEqual(api.put_paths(), [])

    def test_behind_pr_updates_branch_but_does_not_merge(self):
        api = FakeApi(mergeable_state="behind")
        self.assertEqual(self._evaluate(api), "updated")
        self.assertEqual(
            api.put_paths(),
            ["/repos/karnalooch/stunning-pancake/pulls/42/update-branch"],
        )

    def test_fork_or_non_owner_author_never_reaches_merge(self):
        for api in (
            FakeApi(head_repo="someone/fork"),
            FakeApi(author="someone-else"),
        ):
            with self.subTest(author=api.author, head_repo=api.head_repo):
                self.assertEqual(self._evaluate(api), "blocked")
                self.assertEqual(api.put_paths(), [])


if __name__ == "__main__":
    unittest.main()
