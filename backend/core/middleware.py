import json
from django.db import connection
from users.models import AuditLog
from users.rbac_models import UserRole


class TenantRLSMiddleware:
    """
    Extracts the tenant ID from the authenticated user and sets the PostgreSQL
    session variable 'sport.current_tenant_id' so that Row-Level Security (RLS)
    policies can enforce data isolation at the database level.
    """

    SKIP_PATHS = ("/static/", "/media/", "/health/", "/favicon.ico", "/docs/", "/schema/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if any(request.path.startswith(p) for p in self.SKIP_PATHS):
            return self.get_response(request)
        if (
            request.user.is_authenticated
            and hasattr(request.user, "tenant_id")
            and request.user.tenant_id
        ):
            # Set the Postgres session variable for RLS
            with connection.cursor() as cursor:
                # UUIDs must be cast to text for set_config; use parameterized query to prevent SQL injection
                cursor.execute(
                    "SELECT set_config('app.tenant_id', %s, false);", [str(request.user.tenant_id)]
                )
        else:
            # Clear it out if unauthenticated or no tenant (e.g. GLOBAL_OWNER)
            with connection.cursor() as cursor:
                cursor.execute("SELECT set_config('app.tenant_id', '', false);")

        # Set RBAC context
        self._set_rbac_context(request)

        response = self.get_response(request)
        return response

    def _set_rbac_context(self, request):
        """Set RBAC permissions in request for use in views."""
        if request.user.is_authenticated and hasattr(request.user, "get_permissions"):
            tenant_id = getattr(request.user, "tenant_id", None)
            request.user_permissions = request.user.get_permissions(tenant_id)
        else:
            request.user_permissions = set()


class ImpersonationAuditMiddleware:
    """
    Detects if the incoming request is performed via an impersonated token
    and logs mutating requests (POST, PUT, PATCH, DELETE) to the AuditLog table.

    Fixes applied:
    - Block 2 (admin logging) now only logs mutating requests (POST, PUT, PATCH, DELETE),
      preventing audit log flooding from GET/HEAD/OPTIONS requests.
    - Block 2 skips logging if the request was already logged as an impersonated action,
      preventing duplicate entries.
    - Uses ForeignKey-based fields (impersonator, target_user) instead of raw integer fields.
    - Populates tenant_id from the request user's tenant for multi-tenant filtering.
    """

    MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Determine auth state once
        is_authenticated = request.user.is_authenticated if hasattr(request, "user") else False
        user_role = getattr(request.user, "role", None) if is_authenticated else None
        tenant_id = (
            str(request.user.tenant_id) if is_authenticated and request.user.tenant_id else None
        )

        has_auth = hasattr(request, "auth")
        auth_is_dict = has_auth and hasattr(request.auth, "get")
        is_impersonated = request.auth.get("impersonated", False) if auth_is_dict else False

        # Only log mutating requests
        if request.method not in self.MUTATING_METHODS:
            return response

        # Block 1: Impersonation logging
        logged_as_impersonation = False
        if auth_is_dict and is_impersonated:
            impersonator_id = request.auth.get("impersonator_id")
            action = f"Impersonated Action: {request.method} {request.path}"

            AuditLog.objects.create(
                impersonator_id=impersonator_id,
                target_user_id=request.user.id,
                action=action,
                ip_address=self.get_client_ip(request),
                status_code=response.status_code,
                tenant_id=tenant_id,
            )
            logged_as_impersonation = True

        # Block 2: Admin logging — only for mutating requests, skip if already logged as impersonation
        if (
            is_authenticated
            and user_role in ("GLOBAL_OWNER", "TENANT_ADMIN")
            and not logged_as_impersonation
        ):
            # If the admin deletes their own user account, avoid creating an AuditLog row
            # that would temporarily reference the row being deleted (SQLite teardown FK checks
            # can otherwise fail for this self-delete scenario).
            skip_self_delete_audit = False
            if (
                request.method == "DELETE"
                and "/api/users/" in request.path
                and "/delete/" in request.path
            ):
                import re

                m = re.search(r"/api/users/(\d+)/delete/", request.path)
                if m and int(m.group(1)) == request.user.id:
                    skip_self_delete_audit = True

            action = f"Admin Action: {request.method} {request.path}"
            if not skip_self_delete_audit:
                AuditLog.objects.create(
                    impersonator_id=request.user.id,
                    target_user_id=None,
                    action=action,
                    ip_address=self.get_client_ip(request),
                    status_code=response.status_code,
                    tenant_id=tenant_id,
                )

        return response

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0]
        return request.META.get("REMOTE_ADDR")
