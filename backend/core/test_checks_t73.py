"""T73 contract tests for the Django deploy check."""

from unittest.mock import patch

from django.core.checks import Error
from django.test import SimpleTestCase

from core.checks import check_runtime_database_role_cannot_bypass_rls
from core.db_role_guard import UnsafeRuntimeDatabaseRole


class RuntimeDatabaseRoleDeployCheckTests(SimpleTestCase):
    @patch("core.checks.runtime_database_role_guard_required", return_value=False)
    @patch("core.checks.assert_runtime_database_role_safe")
    def test_unguarded_development_skips_database_probe(self, safe, _required):
        self.assertEqual(check_runtime_database_role_cannot_bypass_rls(None), [])
        safe.assert_not_called()

    @patch("core.checks.runtime_database_role_guard_required", return_value=True)
    @patch("core.checks.assert_runtime_database_role_safe")
    def test_safe_guarded_runtime_passes(self, safe, _required):
        self.assertEqual(check_runtime_database_role_cannot_bypass_rls(None), [])
        safe.assert_called_once_with()

    @patch("core.checks.runtime_database_role_guard_required", return_value=True)
    @patch("core.checks.assert_runtime_database_role_safe")
    def test_unsafe_guarded_runtime_is_blocking_error(self, safe, _required):
        safe.side_effect = UnsafeRuntimeDatabaseRole("runtime role is SUPERUSER")

        result = check_runtime_database_role_cannot_bypass_rls(None)

        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], Error)
        self.assertEqual(result[0].id, "core.E002")
        self.assertIn("SUPERUSER", result[0].msg)
