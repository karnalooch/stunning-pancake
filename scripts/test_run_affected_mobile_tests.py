from __future__ import annotations

import unittest
from unittest.mock import patch

from scripts.run_affected_mobile_tests import (
    _discover_related_tests,
    commands_for_plan,
    missing_mandatory_test_paths,
)


class AffectedMobileRunnerTests(unittest.TestCase):
    def test_full_is_one_full_jest_command(self):
        commands = commands_for_plan({"mobile": {"mode": "full"}})
        self.assertEqual(len(commands), 1)
        self.assertNotIn("--findRelatedTests", commands[0])
        self.assertNotIn("--runTestsByPath", commands[0])

    def test_full_targets_mobile_directory(self):
        command = commands_for_plan({"mobile": {"mode": "full"}})[0]
        self.assertEqual(command[:3], ["pnpm", "--dir", "mobile"])
        self.assertNotIn("--filter", command)
        self.assertNotIn("--passWithNoTests", command)
        self.assertNotIn("--", command)
        self.assertEqual(command[3:], ["test", "--ci", "--forceExit"])

    def test_every_mandatory_suite_test_file_exists(self):
        self.assertEqual(missing_mandatory_test_paths(), [])

    def test_skip_has_no_commands(self):
        self.assertEqual(commands_for_plan({"mobile": {"mode": "skip"}}), [])

    @patch("scripts.run_affected_mobile_tests.Path.exists", return_value=True)
    def test_related_uses_find_related_tests(self, _exists):
        commands = commands_for_plan(
            {
                "mobile": {
                    "mode": "related",
                    "relatedFiles": ["mobile/src/components/Foo.tsx"],
                    "directTests": [],
                    "mandatorySuites": [],
                }
            }
        )
        self.assertEqual(len(commands), 1)
        self.assertIn("--findRelatedTests", commands[0])

    def test_auth_mandatory_suite_includes_onboarding(self):
        commands = commands_for_plan(
            {
                "mobile": {
                    "mode": "related",
                    "relatedFiles": [],
                    "directTests": [],
                    "mandatorySuites": ["auth_security"],
                }
            }
        )
        self.assertEqual(len(commands), 1)
        self.assertIn("__tests__/screens/OnboardingScreen.test.tsx", commands[0])

    def test_mandatory_suite_uses_run_tests_by_path(self):
        commands = commands_for_plan(
            {
                "mobile": {
                    "mode": "related",
                    "relatedFiles": [],
                    "directTests": [],
                    "mandatorySuites": ["ride_safety"],
                }
            }
        )
        self.assertEqual(len(commands), 1)
        self.assertIn("--runTestsByPath", commands[0])
        self.assertIn("__tests__/components/RideActionBar.test.tsx", commands[0])

    @patch("scripts.run_affected_mobile_tests.subprocess.run")
    def test_zero_related_discovery_requests_full_fallback(self, run):
        run.return_value.returncode = 0
        run.return_value.stdout = ""
        ok, tests = _discover_related_tests(
            [
                "pnpm",
                "--dir",
                "mobile",
                "test",
                "--ci",
                "--forceExit",
                "--findRelatedTests",
                "/repo/mobile/src/components/Foo.tsx",
            ]
        )
        self.assertTrue(ok)
        self.assertEqual(tests, [])
        self.assertIn("--listTests", run.call_args.args[0])

    @patch("scripts.run_affected_mobile_tests.subprocess.run")
    def test_related_discovery_failure_is_not_treated_as_safe(self, run):
        run.return_value.returncode = 2
        run.return_value.stdout = ""
        ok, tests = _discover_related_tests(
            [
                "pnpm",
                "--dir",
                "mobile",
                "test",
                "--findRelatedTests",
                "/repo/mobile/src/components/Foo.tsx",
            ]
        )
        self.assertFalse(ok)
        self.assertEqual(tests, [])

    def test_unknown_suite_fails_safe_to_full(self):
        commands = commands_for_plan(
            {
                "mobile": {
                    "mode": "related",
                    "relatedFiles": [],
                    "directTests": [],
                    "mandatorySuites": ["future_unknown_suite"],
                }
            }
        )
        self.assertEqual(len(commands), 1)
        self.assertNotIn("--runTestsByPath", commands[0])


if __name__ == "__main__":
    unittest.main()
