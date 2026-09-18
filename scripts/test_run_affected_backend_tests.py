from __future__ import annotations

import unittest

from scripts.run_affected_backend_tests import commands_for_plan


class AffectedBackendRunnerTests(unittest.TestCase):
    def test_full_preserves_current_three_blocking_groups(self):
        commands = commands_for_plan({"backend": {"mode": "full"}})
        self.assertEqual(len(commands), 3)
        self.assertTrue(any("simulator_light" in command for command in commands))
        self.assertTrue(any("test_rls.py" in command for command in commands))
        self.assertTrue(any("activities/test_tenant_moderator_scope.py" in command for command in commands))

    def test_skip_has_no_commands(self):
        self.assertEqual(commands_for_plan({"backend": {"mode": "skip"}}), [])

    def test_domain_gpx_runs_only_gpx_suite(self):
        commands = commands_for_plan(
            {
                "backend": {
                    "mode": "domain",
                    "directTests": [],
                    "mandatorySuites": ["gpx_data"],
                }
            }
        )
        self.assertEqual(len(commands), 1)
        self.assertIn("activities/test_gpx_export.py", commands[0])
        self.assertNotIn("activities/test_simulator_authority.py", commands[0])

    def test_tenant_domain_can_require_real_rls_plus_domain_tests(self):
        commands = commands_for_plan(
            {
                "backend": {
                    "mode": "domain",
                    "directTests": [],
                    "mandatorySuites": ["tenant_security", "rls"],
                }
            }
        )
        self.assertEqual(len(commands), 2)
        self.assertTrue(any("test_rls.py" in command for command in commands))
        self.assertTrue(any("clubs/test_p3_tenant_scope.py" in command for command in commands))

    def test_unknown_suite_fails_safe_to_full(self):
        commands = commands_for_plan(
            {
                "backend": {
                    "mode": "domain",
                    "directTests": [],
                    "mandatorySuites": ["future_unknown_suite"],
                }
            }
        )
        self.assertEqual(len(commands), 3)


if __name__ == "__main__":
    unittest.main()
