from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema
from django.contrib.auth import update_session_auth_hash
from .serializers import (
    UserSerializer,
    RegisterSerializer,
    TenantSerializer,
    AuditLogSerializer,
    PasswordChangeSerializer,
)
from .models import User, Tenant, AuditLog
from .permissions import IsGlobalOwner
from core.api_response import success, error


class RegisterView(generics.CreateAPIView):
    """Register a new Athlete user. Default role is ATHLETE."""
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    @extend_schema(
        responses={201: UserSerializer},
        description="Creates a new athlete account in the SPORT platform.",
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return error("Validation failed", details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        return success(
            data=UserSerializer(user).data,
            message="Account created successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class UserProfileView(generics.RetrieveUpdateAPIView):
    """Retrieve or update the authenticated user's profile."""
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user

    def get(self, request, *args, **kwargs):
        return success(data=UserSerializer(self.get_object()).data)

    def patch(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=True)
        if not serializer.is_valid():
            return error("Validation failed", details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return success(data=serializer.data, message="Profile updated.")


class PasswordChangeView(generics.GenericAPIView):
    """Change the authenticated user's password."""
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = PasswordChangeSerializer

    @extend_schema(
        responses={200: dict},
        description="Change password for the currently logged-in user.",
    )
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return error("Validation failed", details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return error("Current password is incorrect.", status_code=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data["new_password"])
        user.save()
        update_session_auth_hash(request, user)
        return success(message="Password changed successfully.")


class TenantBrandingView(generics.RetrieveAPIView):
    """Get branding details for a specific tenant."""
    permission_classes = (permissions.AllowAny,)

    def get(self, request, tenant_id):
        try:
            tenant = Tenant.objects.get(id=tenant_id, is_active=True)
            return success(data={
                "name": tenant.name,
                "primary_color": tenant.primary_color,
                "secondary_color": tenant.secondary_color,
                "logo_url": tenant.logo.url if tenant.logo else None,
            })
        except Tenant.DoesNotExist:
            return error("Tenant not found.", status_code=status.HTTP_404_NOT_FOUND)


class TenantUpdateView(generics.UpdateAPIView):
    """Update branding and configuration for a tenant."""
    queryset = Tenant.objects.all()
    permission_classes = (permissions.IsAuthenticated,)

    def put(self, request, *args, **kwargs):
        tenant = self.get_object()
        if request.user.role != 'GLOBAL_OWNER' and (
            request.user.role != 'TENANT_ADMIN' or request.user.tenant_id != tenant.id
        ):
            return error("Unauthorized.", status_code=status.HTTP_403_FORBIDDEN)

        tenant.primary_color = request.data.get('primary_color', tenant.primary_color)
        tenant.secondary_color = request.data.get('secondary_color', tenant.secondary_color)
        tenant.save()
        return success(data={
            "status": "success",
            "primary_color": tenant.primary_color,
            "secondary_color": tenant.secondary_color,
        })


class ImpersonateUserView(generics.GenericAPIView):
    """GLOBAL_OWNER can request an access token for another user."""
    permission_classes = (permissions.IsAuthenticated, IsGlobalOwner)
    queryset = User.objects.all()

    @extend_schema(
        responses={200: dict},
        description="Returns an access and refresh token for the specified user.",
    )
    def post(self, request, target_user_id):
        try:
            target_user = User.objects.get(id=target_user_id)
            refresh = RefreshToken.for_user(target_user)
            refresh['impersonated'] = True
            refresh['impersonator_id'] = request.user.id
            return success(data={
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'impersonated_user': target_user.username,
                'impersonated_role': target_user.role,
            })
        except User.DoesNotExist:
            return error("User not found.", status_code=status.HTTP_404_NOT_FOUND)


class UserListView(generics.ListAPIView):
    """List all users. GLOBAL_OWNER only."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated, IsGlobalOwner)


class TenantListView(generics.ListAPIView):
    """List all tenants. GLOBAL_OWNER only."""
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    permission_classes = (permissions.IsAuthenticated, IsGlobalOwner)


class AuditLogListView(generics.ListAPIView):
    """List audit log entries. GLOBAL_OWNER only."""
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = (permissions.IsAuthenticated, IsGlobalOwner)

    def get_queryset(self):
        qs = super().get_queryset()
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                qs = qs[:int(limit)]
            except (ValueError, TypeError):
                pass
        return qs
