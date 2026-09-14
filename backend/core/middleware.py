"""4VELO request middleware.

``TenantRLSMiddleware`` binds the PostgreSQL ``app.tenant_id`` and
``app.is_global_owner`` GUCs to the authenticated session user for the
duration of a single request.

The middleware MUST run **after** Django session authentication
(``AuthenticationMiddleware``) so that ``request.user`` already reflects the
resolved principal. JWT-only requests reach the same code path: the DRF
``MFAEnforcingJWTAuthentication`` class sets the GUCs directly after it
successfully authenticates a JWT - see ``users/jwt_auth.py``.

Tenant resolution rules:

* Session-authenticated ``GLOBAL_OWNER`` (``request.user.role ==
  'GLOBAL_OWNER'``) sets ``app.is_global_owner = 'true'`` and clears
  ``app.tenant_id``.
* Session-authenticated user with a non-empty ``request.user.tenant_id``
  sets ``app.tenant_id`` and clears the global-owner flag.
* Any other request (anonymous, JWT-only before DRF auth runs, or a user
  with neither role nor tenant) clears both GUCs.

Cleanup is unconditional: both GUCs are cleared at the start of the request
and again in ``finally``, so connection pool reuse can never leak scope
across requests.
"""

from __future__ import annotations

from core.rls import (
    clear_all_context,
    set_global_owner_context,
    set_tenant_context,
)
from users.models import AuditLog

GLOBAL_OWNER_ROLE = "GLOBAL_OWNER"


class TenantRLSMiddleware:
    """Bind ``app.tenant_id`` / ``app.is_global_owner`` to the authenticated
    user for the duration of a single request.

    The middleware MUST run **after** Django authentication (``SessionMiddleware``
    + ``AuthenticationMiddleware``) so that ``request.user`` already reflects
    the resolved principal. The JWT counterpart
    (``users.jwt_auth.MFAEnforcingJWTAuthentication``) sets the same GUCs
    directly inside the DRF request lifecycle after a successful JWT
    authentication; that path is responsible for the GUCs while the request
    is in-flight, and ``TenantRLSMiddleware`` still performs the final
    cleanup in ``finally`` so connection pool reuse cannot leak scope.
    """

    SKIP_PATHS = ("/static/", "/media/", "/health/", "/favicon.ico", "/docs/", "/schema/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Always start with a clean slate - the previous request that used
        # this pooled connection must not have left scope behind.
        clear_all_context()

        skip = any(request.path.startswith(p) for p in self.SKIP_PATHS)

        if not skip:
            self._apply_session_scope(request)

        self._set_rbac_context(request)

        try:
            response = self.get_response(request)
        finally:
            # Unconditional cleanup: also covers exceptions, rollbacks, and
            # requests served via DRF JWT (whose auth class sets the same
            # GUCs inside the view execution). The cleanup runs even when
            # the view raised - leaving scope behind would expose it to
            # the next request on this pooled connection.
            try:
                clear_all_context()
            except Exception:
                pass

        return response

    def _apply_session_scope(self, request) -> None:
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            clear_all_context()
            return

        role = getattr(user, "role", None)
        if role == GLOBAL_OWNER_ROLE:
            try:
                set_global_owner_context()
            except Exception:
                clear_all_context()
            return

        raw_tenant = getattr(user, "tenant_id", None)
        if raw_tenant:
            try:
                set_tenant_context(raw_tenant)
            except Exception:
                # Invalid tenant id on an authenticated user is a programming
                # error; treat as no scope rather than raising - the policies
                # below fail-closed anyway.
                clear_all_context()
            return

        clear_all_context()

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

        is_authenticated = request.user.is_authenticated if hasattr(request, "user") else False
        user_role = getattr(request.user, "role", None) if is_authenticated else None
        tenant_id = (
            str(request.user.tenant_id) if is_authenticated and request.user.tenant_id else None
        )

        has_auth = hasattr(request, "auth")
        auth_is_dict = has_auth and hasattr(request.auth, "get")
        is_impersonated = request.auth.get("impersonated", False) if auth_is_dict else False

        if request.method not in self.MUTATING_METHODS:
            return response

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

        if (
            is_authenticated
            and user_role in ("GLOBAL_OWNER", "TENANT_ADMIN")
            and not logged_as_impersonation
        ):
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
