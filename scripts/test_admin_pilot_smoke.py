import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import admin_pilot_smoke


class AdminPilotSmokeTests(unittest.TestCase):
    def test_normalize_admin_url_requires_explicit_secret_free_http_url(self):
        self.assertEqual(
            admin_pilot_smoke.normalize_admin_url("https://pilot.example.test/"),
            "https://pilot.example.test",
        )
        for value in (
            None,
            "",
            "pilot.example.test",
            "ftp://pilot.example.test",
            "https://user:secret@pilot.example.test",
            "https://pilot.example.test/?token=secret",
            "https://pilot.example.test/#fragment",
        ):
            with self.subTest(value=value), self.assertRaises(SystemExit):
                admin_pilot_smoke.normalize_admin_url(value)

    def test_selected_roles_default_contract(self):
        self.assertEqual(
            admin_pilot_smoke.selected_roles("both"),
            ["TENANT_ADMIN", "GLOBAL_OWNER"],
        )
        self.assertEqual(admin_pilot_smoke.selected_roles("t85"), ["TENANT_ADMIN"])
        self.assertEqual(admin_pilot_smoke.selected_roles("t86"), ["GLOBAL_OWNER"])

    def test_role_credentials_fail_closed_on_missing_or_reused_accounts(self):
        env = {
            "ADMIN_USER_TENANT_ADMIN": "tenant-admin",
            "ADMIN_PASS_TENANT_ADMIN": "secret-a",
            "ADMIN_USER_GLOBAL_OWNER": "global-owner",
            "ADMIN_PASS_GLOBAL_OWNER": "secret-b",
        }
        admin_pilot_smoke.require_role_credentials(
            ["TENANT_ADMIN", "GLOBAL_OWNER"], env
        )

        missing = dict(env)
        missing.pop("ADMIN_PASS_GLOBAL_OWNER")
        with self.assertRaises(SystemExit):
            admin_pilot_smoke.require_role_credentials(
                ["TENANT_ADMIN", "GLOBAL_OWNER"], missing
            )

        reused = dict(env)
        reused["ADMIN_USER_GLOBAL_OWNER"] = "tenant-admin"
        with self.assertRaises(SystemExit):
            admin_pilot_smoke.require_role_credentials(
                ["TENANT_ADMIN", "GLOBAL_OWNER"], reused
            )

    def test_exact_checkout_rejects_mismatch_and_dirty_tree(self):
        expected = "a" * 40
        with patch.object(
            admin_pilot_smoke,
            "capture",
            side_effect=["b" * 40],
        ), self.assertRaises(SystemExit):
            admin_pilot_smoke.assert_exact_checkout(expected)

        with patch.object(
            admin_pilot_smoke,
            "capture",
            side_effect=[expected, " M admin/src/App.tsx"],
        ), self.assertRaises(SystemExit):
            admin_pilot_smoke.assert_exact_checkout(expected)

        with patch.object(
            admin_pilot_smoke,
            "capture",
            side_effect=[expected, ""],
        ):
            self.assertEqual(
                admin_pilot_smoke.assert_exact_checkout(expected),
                expected,
            )

    def test_validate_smoke_report_requires_every_requested_role_to_pass_without_skip(self):
        report = {
            "base": "https://pilot.example.test",
            "results": [
                {"role": "TENANT_ADMIN", "skipped": False, "pass": True},
                {"role": "GLOBAL_OWNER", "skipped": False, "pass": True},
            ],
        }
        ok, reasons, selected = admin_pilot_smoke.validate_smoke_report(
            report,
            required_roles=["TENANT_ADMIN", "GLOBAL_OWNER"],
            admin_url="https://pilot.example.test",
        )
        self.assertTrue(ok)
        self.assertEqual(reasons, [])
        self.assertEqual(set(selected), {"TENANT_ADMIN", "GLOBAL_OWNER"})

        skipped = {
            **report,
            "results": [
                {"role": "TENANT_ADMIN", "skipped": False, "pass": True},
                {"role": "GLOBAL_OWNER", "skipped": True, "reason": "missing credentials"},
            ],
        }
        ok, reasons, _ = admin_pilot_smoke.validate_smoke_report(
            skipped,
            required_roles=["TENANT_ADMIN", "GLOBAL_OWNER"],
            admin_url="https://pilot.example.test",
        )
        self.assertFalse(ok)
        self.assertIn("GLOBAL_OWNER: skipped", reasons)

    def test_p0_role_smoke_covers_t85_t86_required_navigation(self):
        smoke = (
            admin_pilot_smoke.ROOT / "admin" / "scripts" / "p0-role-smoke.mjs"
        ).read_text(encoding="utf-8")
        self.assertIn("'GLOBAL_OWNER'", smoke)
        self.assertIn("'TENANT_ADMIN'", smoke)
        self.assertGreaterEqual(smoke.count("'/owner/activities'"), 2)
        self.assertGreaterEqual(smoke.count("'/owner/analytics/audit-log'"), 2)

    def test_evidence_is_commit_bound_and_secret_free(self):
        with tempfile.TemporaryDirectory() as folder:
            evidence_dir = Path(folder)
            smoke_report = {
                "base": "https://pilot.example.test",
                "results": [
                    {
                        "role": "TENANT_ADMIN",
                        "skipped": False,
                        "pass": True,
                        "failures": [],
                    },
                    {
                        "role": "GLOBAL_OWNER",
                        "skipped": False,
                        "pass": True,
                        "failures": [],
                    },
                ],
            }
            with patch.object(admin_pilot_smoke, "EVIDENCE_DIR", evidence_dir):
                path = admin_pilot_smoke.write_evidence(
                    git_commit="c" * 40,
                    admin_url="https://pilot.example.test",
                    roles=["TENANT_ADMIN", "GLOBAL_OWNER"],
                    smoke_exit_code=0,
                    smoke_report=smoke_report,
                    automated_pass=True,
                    failure_reasons=[],
                )

            content = path.read_text(encoding="utf-8")
            self.assertIn('"git_commit": "' + "c" * 40 + '"', content)
            self.assertIn('"overall_status": "PASS"', content)
            self.assertIn("manual_observations_required_before_tranche_done", content)
            self.assertNotIn("ADMIN_PASS", content)
            self.assertNotIn("secret-a", content)
            self.assertNotIn("secret-b", content)


if __name__ == "__main__":
    unittest.main()
