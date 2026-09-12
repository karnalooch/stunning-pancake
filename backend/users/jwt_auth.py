from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from users.mfa_policy import ADMIN_ROLES

MFA_ENROLLMENT_PATHS = {
    "/api/users/profile/",
    "/api/users/mfa/status/",
    "/api/users/mfa/setup/",
    "/api/users/mfa/enable/",
    "/api/users/mfa/verify-session/",
}


class MFAEnforcingJWTAuthentication(JWTAuthentication):
    """Restrict pre-MFA administrator tokens to enrollment endpoints."""

    def authenticate(self, request):
        authenticated = super().authenticate(request)
        if authenticated is None:
            return None
        user, token = authenticated
        # Use the role loaded from the database, not only token claims.  This
        # closes the role-escalation gap for an athlete token issued before the
        # account became an administrator.
        restricted = user.role in ADMIN_ROLES and not token.get("mfa_verified")
        if restricted and request.path not in MFA_ENROLLMENT_PATHS:
            raise AuthenticationFailed("MFA setup is required before using this session.")
        return user, token
