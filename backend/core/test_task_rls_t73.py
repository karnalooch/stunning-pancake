"""T73 tests for Celery tenant/global-owner RLS scope propagation."""

import uuid
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from core.task_rls import (
    GLOBAL_OWNER_TASK_HEADER,
    TENANT_TASK_HEADER,
    InvalidTaskRLSContext,
    _trusted_connection_headers,
    apply_task_rls_scope,
    global_owner_task_headers,
    task_headers_for_user,
    tenant_task_headers,
)


TENANT_ID = uuid.UUID("11111111-2222-4333-8444-555555555555")


class TaskHeaderBuilderTests(SimpleTestCase):
    def test_tenant_header_normalizes_uuid(self):
        self.assertEqual(
            tenant_task_headers(str(TENANT_ID)),
            {TENANT_TASK_HEADER: str(TENANT_ID)},
        )

    def test_invalid_tenant_header_is_rejected(self):
        with self.assertRaises(InvalidTaskRLSContext):
            tenant_task_headers("not-a-uuid")

    def test_user_scope_comes_only_from_server_side_role_and_tenant(self):
        tenant_user = SimpleNamespace(role="ATHLETE", tenant_id=TENANT_ID)
        owner = SimpleNamespace(role="GLOBAL_OWNER", tenant_id=None)

        self.assertEqual(task_headers_for_user(tenant_user), tenant_task_headers(TENANT_ID))
        self.assertEqual(task_headers_for_user(owner), global_owner_task_headers())

    def test_tenant_user_without_tenant_is_rejected(self):
        with self.assertRaises(InvalidTaskRLSContext):
            task_headers_for_user(SimpleNamespace(role="ATHLETE", tenant_id=None))


class ApplyTaskScopeTests(SimpleTestCase):
    @patch("core.task_rls.set_tenant_context")
    @patch("core.task_rls.clear_all_context")
    def test_applies_tenant_scope_after_clearing_stale_context(self, clear, set_tenant):
        apply_task_rls_scope({TENANT_TASK_HEADER: str(TENANT_ID)})

        clear.assert_called_once_with()
        set_tenant.assert_called_once_with(str(TENANT_ID))

    @patch("core.task_rls.set_global_owner_context")
    @patch("core.task_rls.clear_all_context")
    def test_applies_explicit_global_owner_scope(self, clear, set_global):
        apply_task_rls_scope({GLOBAL_OWNER_TASK_HEADER: True})

        clear.assert_called_once_with()
        set_global.assert_called_once_with()

    @patch("core.task_rls.clear_all_context")
    def test_ambiguous_scope_is_rejected(self, clear):
        with self.assertRaisesRegex(InvalidTaskRLSContext, "cannot carry tenant"):
            apply_task_rls_scope(
                {
                    TENANT_TASK_HEADER: str(TENANT_ID),
                    GLOBAL_OWNER_TASK_HEADER: True,
                }
            )
        self.assertGreaterEqual(clear.call_count, 2)

    @patch("core.task_rls.clear_all_context")
    def test_noncanonical_global_owner_value_is_rejected(self, _clear):
        with self.assertRaisesRegex(InvalidTaskRLSContext, "boolean true"):
            apply_task_rls_scope({GLOBAL_OWNER_TASK_HEADER: "true"})

    @patch("core.task_rls.clear_all_context")
    def test_required_scope_fails_closed_when_missing(self, _clear):
        with self.assertRaisesRegex(InvalidTaskRLSContext, "requires an explicit"):
            apply_task_rls_scope({}, require_scope=True)


class ConnectionScopePropagationTests(SimpleTestCase):
    def _mock_connection_row(self, row):
        patcher = patch("core.task_rls.connection")
        db = patcher.start()
        self.addCleanup(patcher.stop)
        db.vendor = "postgresql"
        cursor = db.cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = row
        return db

    def test_reads_tenant_scope_from_current_postgres_connection(self):
        self._mock_connection_row((str(TENANT_ID), None))
        self.assertEqual(_trusted_connection_headers(), tenant_task_headers(TENANT_ID))

    def test_reads_global_owner_scope_only_from_canonical_true_guc(self):
        self._mock_connection_row((None, "true"))
        self.assertEqual(
            _trusted_connection_headers(),
            {GLOBAL_OWNER_TASK_HEADER: True},
        )

    def test_rejects_ambiguous_connection_scope(self):
        self._mock_connection_row((str(TENANT_ID), "true"))
        with self.assertRaisesRegex(InvalidTaskRLSContext, "ambiguous"):
            _trusted_connection_headers()

    def test_rejects_noncanonical_global_owner_guc(self):
        self._mock_connection_row((None, "1"))
        with self.assertRaisesRegex(InvalidTaskRLSContext, "canonical true"):
            _trusted_connection_headers()

    @patch("core.task_rls.connection")
    def test_non_postgresql_dispatch_does_not_invent_scope(self, db):
        db.vendor = "sqlite"
        self.assertEqual(_trusted_connection_headers(), {})
