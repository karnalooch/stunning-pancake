"""JWT login with MFA gate for GLOBAL_OWNER (P2 Auth)."""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from users.mfa import verify_totp


class MfaTokenObtainPairSerializer(TokenObtainPairSerializer):
    mfa_code = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        if getattr(user, "mfa_enabled", False) and getattr(user, "role", None) == "GLOBAL_OWNER":
            code = (attrs.get("mfa_code") or "").strip()
            if not code:
                raise serializers.ValidationError(
                    {"mfa_required": True, "detail": "MFA code required for this account."}
                )
            secret = getattr(user, "mfa_secret", None)
            if not secret or not verify_totp(secret, code):
                raise serializers.ValidationError({"detail": "Invalid MFA code."})
        return data


class MfaTokenObtainPairView(TokenObtainPairView):
    serializer_class = MfaTokenObtainPairSerializer
