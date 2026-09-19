from __future__ import annotations

import unittest

from scripts.auto_merge import (
    auto_merge_mode,
    has_changes_requested,
    is_risky_path,
    latest_check_conclusions,
    missing_required_checks,
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
            "pnpm-lock.yaml",
            "backend/requirements.txt",
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


if __name__ == "__main__":
    unittest.main()
