"""
P3 Tests — TenantRLSMiddleware + ImpersonationAuditMiddleware
==============================================================
Tests the P0 Issue 2 fixes: skip static paths, tenant session
variable setting, and impersonation audit logging for mutating requests.
"""

import pytest
from unittest.mock import MagicMock, patch
from core.middleware import TenantRLSMiddleware, ImpersonationAuditMiddleware


class TestTenantRLSMiddleware:
    def test_skips_static_paths(self):
        """Middleware should skip SQL execution for static/health paths."""
        mock_get_response = MagicMock()
        middleware = TenantRLSMiddleware(mock_get_response)

        for path in (
            "/static/app.js",
            "/media/logo.png",
            "/health/",
            "/favicon.ico",
            "/docs/",
            "/schema/",
        ):
            request = MagicMock()
            request.path = path
            request.user.is_authenticated = True

            with patch("core.middleware.connection") as mock_conn:
                middleware(request)
                mock_conn.cursor.assert_not_called()

    def test_sets_tenant_for_authenticated_user(self):
        """Middleware should set tenant_id for authenticated users with a tenant."""
        mock_get_response = MagicMock()
        middleware = TenantRLSMiddleware(mock_get_response)

        request = MagicMock()
        request.path = "/api/activities/"
        request.user.is_authenticated = True
        request.user.tenant_id = "test-uuid-123"

        with patch("core.middleware.connection") as mock_conn:
            mock_cursor = MagicMock()
            mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
            mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
            middleware(request)
            mock_conn.cursor.assert_called()

    def test_clears_tenant_for_unauthenticated_user(self):
        """Middleware should clear tenant_id for unauthenticated users."""
        mock_get_response = MagicMock()
        middleware = TenantRLSMiddleware(mock_get_response)

        request = MagicMock()
        request.path = "/api/activities/"
        request.user.is_authenticated = False

        with patch("core.middleware.connection") as mock_conn:
            mock_cursor = MagicMock()
            mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
            mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
            middleware(request)
            mock_conn.cursor.assert_called()


class TestImpersonationAuditMiddleware:
    def test_does_not_log_get_requests(self):
        """Middleware should not log GET/HEAD/OPTIONS requests."""
        mock_get_response = MagicMock()
        middleware = ImpersonationAuditMiddleware(mock_get_response)

        request = MagicMock()
        request.method = "GET"
        request.user.is_authenticated = True
        request.user.role = "GLOBAL_OWNER"
        request.user.id = 1
        request.user.tenant_id = None
        request.auth = {}

        with patch("core.middleware.AuditLog") as mock_audit:
            middleware(request)
            mock_audit.objects.create.assert_not_called()

    def test_logs_impersonated_mutating_requests(self):
        """Middleware should log POST/PUT/PATCH/DELETE during impersonation."""
        mock_get_response = MagicMock()
        middleware = ImpersonationAuditMiddleware(mock_get_response)

        request = MagicMock()
        request.method = "POST"
        request.path = "/api/users/1/"
        request.user.is_authenticated = True
        request.user.id = 42
        request.user.tenant_id = "tenant-uuid"
        request.auth = {"impersonated": True, "impersonator_id": 1}
        request.META = {"REMOTE_ADDR": "127.0.0.1"}

        response = MagicMock()
        response.status_code = 200
        mock_get_response.return_value = response

        with patch("core.middleware.AuditLog") as mock_audit:
            result = middleware(request)
            mock_audit.objects.create.assert_called_once()
            assert result.status_code == 200

    def test_logs_admin_mutating_requests(self):
        """Middleware should log POST/PUT/PATCH/DELETE for admin roles."""
        mock_get_response = MagicMock()
        middleware = ImpersonationAuditMiddleware(mock_get_response)

        request = MagicMock()
        request.method = "DELETE"
        request.path = "/api/activities/5/"
        request.user.is_authenticated = True
        request.user.id = 99
        request.user.tenant_id = "tenant-xyz"
        request.user.role = "TENANT_ADMIN"
        request.auth = {}
        request.META = {}

        response = MagicMock()
        response.status_code = 204
        mock_get_response.return_value = response

        with patch("core.middleware.AuditLog") as mock_audit:
            result = middleware(request)
            mock_audit.objects.create.assert_called_once()
            assert result.status_code == 204

    def test_skips_non_impersonated_non_admin(self):
        """Middleware should not log mutating requests from regular users."""
        mock_get_response = MagicMock()
        middleware = ImpersonationAuditMiddleware(mock_get_response)

        request = MagicMock()
        request.method = "POST"
        request.path = "/api/activities/"
        request.user.is_authenticated = True
        request.user.id = 7
        request.user.tenant_id = "tenant-x"
        request.user.role = "ATHLETE"
        request.auth = {}
        request.META = {}

        response = MagicMock()
        response.status_code = 201
        mock_get_response.return_value = response

        with patch("core.middleware.AuditLog") as mock_audit:
            result = middleware(request)
            mock_audit.objects.create.assert_not_called()
            assert result.status_code == 201
