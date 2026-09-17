"""T73 tests for production PostgreSQL runtime-role hardening."""

from unittest.mock import patch

from django.test import SimpleTestCase

from core.db_role_guard import (
    UnsafeRuntimeDatabaseRole,
    assert_runtime_database_role_safe,
    enforce_production_runtime_database_role,
    get_runtime_database_role,
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

    @patch("core.db_role_guard.is_production_runtime", return_value=False)
    @patch("core.db_role_guard.assert_runtime_database_role_safe")
    def test_nonproduction_does_not_probe_runtime_role(self, safe, _production):
        self.assertIsNone(enforce_production_runtime_database_role())
        safe.assert_not_called()

    @patch("core.db_role_guard.is_production_runtime", return_value=True)
    @patch("core.db_role_guard.assert_runtime_database_role_safe")
    def test_production_enforces_runtime_role(self, safe, _production):
        sentinel = object()
        safe.return_value = sentinel

        self.assertIs(enforce_production_runtime_database_role(), sentinel)
        safe.assert_called_once_with()
