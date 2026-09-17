"""T73 tests for PostgreSQL runtime-role hardening."""

from unittest.mock import patch

from django.test import SimpleTestCase

from core.db_role_guard import (
    UnsafeRuntimeDatabaseRole,
    assert_runtime_database_role_safe,
    enforce_runtime_database_role_if_required,
    get_runtime_database_role,
    runtime_database_role_guard_required,
)


class RuntimeDatabaseRoleGuardTests(SimpleTestCase):
    def _mock_role(self, row):
        patcher = patch("core.db_role_guard.connection")
        db = patcher.start()
        self.addCleanup(patcher.stop)
        db.vendor = "postgresql"
        cursor = db.cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = row
        return db

    def test_accepts_nonsuperuser_without_bypassrls(self):
        self._mock_role(("fourvelo_runtime", False, False))

        role = assert_runtime_database_role_safe()

        self.assertEqual(role.name, "fourvelo_runtime")
        self.assertFalse(role.is_superuser)
        self.assertFalse(role.bypasses_rls)

    def test_rejects_superuser_runtime_role(self):
        self._mock_role(("postgres", True, False))

        with self.assertRaisesRegex(UnsafeRuntimeDatabaseRole, "SUPERUSER"):
            assert_runtime_database_role_safe()

    def test_rejects_bypassrls_runtime_role(self):
        self._mock_role(("runtime", False, True))

        with self.assertRaisesRegex(UnsafeRuntimeDatabaseRole, "BYPASSRLS"):
            assert_runtime_database_role_safe()

    @patch("core.db_role_guard.connection")
    def test_rejects_non_postgresql_runtime(self, db):
        db.vendor = "sqlite"

        with self.assertRaisesRegex(UnsafeRuntimeDatabaseRole, "requires PostgreSQL"):
            get_runtime_database_role()

    @patch.dict("os.environ", {"RLS_RUNTIME_ROLE_GUARD": "0"}, clear=False)
    @patch("core.db_role_guard.is_production_runtime", return_value=False)
    def test_guard_not_required_in_ordinary_development(self, _production):
        self.assertFalse(runtime_database_role_guard_required())

    @patch.dict("os.environ", {"RLS_RUNTIME_ROLE_GUARD": "1"}, clear=False)
    @patch("core.db_role_guard.is_production_runtime", return_value=False)
    def test_pilot_can_require_guard_even_with_debug(self, _production):
        self.assertTrue(runtime_database_role_guard_required())

    @patch.dict("os.environ", {"RLS_RUNTIME_ROLE_GUARD": "0"}, clear=False)
    @patch("core.db_role_guard.is_production_runtime", return_value=True)
    def test_production_cannot_opt_out(self, _production):
        self.assertTrue(runtime_database_role_guard_required())

    @patch("core.db_role_guard.runtime_database_role_guard_required", return_value=False)
    @patch("core.db_role_guard.assert_runtime_database_role_safe")
    def test_unguarded_runtime_does_not_probe_role(self, safe, _required):
        self.assertIsNone(enforce_runtime_database_role_if_required())
        safe.assert_not_called()

    @patch("core.db_role_guard.runtime_database_role_guard_required", return_value=True)
    @patch("core.db_role_guard.assert_runtime_database_role_safe")
    def test_guarded_runtime_enforces_role(self, safe, _required):
        sentinel = object()
        safe.return_value = sentinel

        self.assertIs(enforce_runtime_database_role_if_required(), sentinel)
        safe.assert_called_once_with()
