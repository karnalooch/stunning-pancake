from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from core.rls import (
    clear_all_context,
    set_global_owner_context,
    set_tenant_context,
)
from users.mfa_policy import ADMIN_ROLES

MFA_ENROLLMENT_PATHS = {
    "/api/users/profile/",
    "/api/users/mfa/status/",
    "/api/users/mfa/setup/",
    "/api/users/mfa/enable/",
    "/api/users/mfa/verify-session/",
}


class MFAEnforcingJWTAuthentication(JWTAuthentication):
    """Restrict pre-MFA administrator tokens to enrollment endpoints.

    In addition to the MFA gate, this class binds the PostgreSQL
    ``app.tenant_id`` / ``app.is_global_owner`` GUCs to the authenticated
    principal for the duration of the DRF view execution. The
    ``TenantRLSMiddleware`` is responsible for the initial GUC clear and the
    final cleanup in its ``finally``; this class only sets the GUCs after a
    successful ``authenticate`` call and is therefore safe to rely on for
    every JWT-only request that bypasses the session middleware.

    Scope is derived exclusively from the resolved ``request.user`` (database
    role + tenant_id), never from query/body/header parameters.
    """

    GLOBAL_OWNER_ROLE = "GLOBAL_OWNER"

    def authenticate(self, request):
        # The middleware already cleared both GUCs at the start of the
        # request; clear them again here so this code is self-contained for
        # any future caller that does not run middleware first.
        clear_all_context()
        try:
            authenticated = super().authenticate(request)
        except Exception:
            clear_all_context()
            raise

        if authenticated is None:
            clear_all_context()
            return None

        user, token = authenticated
        # Use the role loaded from the database, not only token claims.  This
        # closes the role-escalation gap for an athlete token issued before the
        # account became an administrator.
        restricted = user.role in ADMIN_ROLES and not token.get("mfa_verified")
        if restricted and request.path not in MFA_ENROLLMENT_PATHS:
            clear_all_context()
            raise AuthenticationFailed("MFA setup is required before using this session.")

        # Bind PostgreSQL session GUCs to the authenticated principal. The
        # TenantRLSMiddleware will clear both GUCs in its own ``finally``
        # when the request finishes, so this binding is per-request and
        # cannot leak across pooled connections.
        if getattr(user, "role", None) == self.GLOBAL_OWNER_ROLE:
            set_global_owner_context()
        else:
            raw_tenant = getattr(user, "tenant_id", None)
            if raw_tenant:
                try:
                    set_tenant_context(raw_tenant)
                except Exception:
                    clear_all_context()
            else:
                clear_all_context()

        return user, token
