from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from users.mfa import verify_totp
from users.mfa_policy import ADMIN_ROLES


def token_pair_for_user(user, *, setup_required=False):
    refresh = TokenObtainPairSerializer.get_token(user)
    if user.role in ADMIN_ROLES:
        if setup_required:
            refresh["mfa_setup_required"] = True
        else:
            refresh["mfa_verified"] = True
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


def restricted_token_pair_for_user(user):
    refresh = TokenObtainPairSerializer.get_token(user)
    if user.role in ADMIN_ROLES:
        claim = "mfa_verification_required" if user.mfa_enabled else "mfa_setup_required"
        refresh[claim] = True
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


class MFATokenObtainPairSerializer(TokenObtainPairSerializer):
    mfa_code = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs):
        code = str(attrs.pop("mfa_code", "")).strip()
        data = super().validate(attrs)
        if self.user.role not in ADMIN_ROLES:
            return data
        if self.user.mfa_enabled:
            if not verify_totp(self.user.mfa_secret, code):
                raise serializers.ValidationError({"mfa_code": "A valid MFA code is required."})
            data.update(token_pair_for_user(self.user))
            data["mfa_required"] = True
            return data

        data.update(token_pair_for_user(self.user, setup_required=True))
        data["mfa_setup_required"] = True
        return data


class MFATokenObtainPairView(TokenObtainPairView):
    serializer_class = MFATokenObtainPairSerializer
