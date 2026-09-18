from __future__ import annotations

import unittest
from unittest.mock import patch

from scripts.run_affected_mobile_tests import commands_for_plan


class AffectedMobileRunnerTests(unittest.TestCase):
    def test_full_is_one_full_jest_command(self):
        commands = commands_for_plan({"mobile": {"mode": "full"}})
        self.assertEqual(len(commands), 1)
        self.assertNotIn("--findRelatedTests", commands[0])
        self.assertNotIn("--runTestsByPath", commands[0])

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
