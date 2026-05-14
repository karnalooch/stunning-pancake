import contextlib

from django.contrib.auth import update_session_auth_hash
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework_simplejwt.tokens import RefreshToken

from core.api_response import error, success
from core.email_service import EmailService

from .models import AuditLog, Tenant, User
from .permissions import IsGlobalOwner
from .serializers import (
    AuditLogSerializer,
    PasswordChangeSerializer,
    RegisterSerializer,
    TenantSerializer,
    UserSerializer,
)


class PasswordResetRequestView(generics.GenericAPIView):
    """Request a password reset token via email."""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return error("Email is required.", status_code=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
            # Generate a simple reset token (in production, use django.contrib.auth.tokens)
            import secrets
            token = secrets.token_urlsafe(32)
            from django.core.cache import cache
            cache.set(f'password_reset:{token}', user.id, timeout=1800)  # 30 min

            EmailService.send_password_reset(email, token)
            return success(message="If an account exists, a reset email has been sent.")
        except User.DoesNotExist:
            return success(message="If an account exists, a reset email has been sent.")


class PasswordResetConfirmView(generics.GenericAPIView):
    """Confirm password reset with token and new password."""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        token = request.data.get('token', '').strip()
        new_password = request.data.get('new_password', '').strip()

        if not token or len(new_password) < 8:
            return error("Invalid token or password too short.", status_code=status.HTTP_400_BAD_REQUEST)

        from django.core.cache import cache
        user_id = cache.get(f'password_reset:{token}')
        if not user_id:
            return error("Invalid or expired reset token.", status_code=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(pk=user_id)
            user.set_password(new_password)
            user.save()
            cache.delete(f'password_reset:{token}')
            return success(message="Password reset successful.")
        except User.DoesNotExist:
            return error("User not found.", status_code=status.HTTP_404_NOT_FOUND)


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
            with contextlib.suppress(ValueError, TypeError):
                qs = qs[:int(limit)]
        return qs


class UserCreateView(generics.CreateAPIView):
    """Admin creates a new user with role + tenant assignment."""
    serializer_class = RegisterSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        user_role = getattr(request.user, 'role', None)
        if user_role not in ('GLOBAL_OWNER', 'TENANT_ADMIN'):
            return error("Only admins can create users.", status_code=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return error("Validation failed", details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        role = request.data.get('role', 'ATHLETE')
        if role in dict(Role.choices):
            user.role = role
        tenant_id = request.data.get('tenant_id')
        if tenant_id:
            with contextlib.suppress(Tenant.DoesNotExist):
                user.tenant = Tenant.objects.get(id=tenant_id)
        user.save()

        AuditLog.objects.create(
            impersonator=request.user,
            target_user=user,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            action=f"Created user {user.username} with role {user.role}",
            ip_address=request.META.get('REMOTE_ADDR'),
            status_code=201,
        )

        return success(
            data=UserSerializer(user).data,
            message=f"User {user.username} created.",
            status_code=status.HTTP_201_CREATED,
        )


class UserDeleteView(generics.DestroyAPIView):
    """Admin deletes a user."""
    queryset = User.objects.all()
    permission_classes = (permissions.IsAuthenticated,)

    def delete(self, request, *args, **kwargs):
        user_role = getattr(request.user, 'role', None)
        if user_role not in ('GLOBAL_OWNER', 'TENANT_ADMIN'):
            return error("Only admins can delete users.", status_code=status.HTTP_403_FORBIDDEN)

        try:
            target = User.objects.get(pk=kwargs['pk'])
            AuditLog.objects.create(
                impersonator=request.user,
                target_user=target,
                tenant_id=str(target.tenant_id) if target.tenant_id else None,
                action=f"Deleted user {target.username} (role: {target.role})",
                ip_address=request.META.get('REMOTE_ADDR'),
                status_code=200,
            )
            username = target.username
            target.delete()
            return success(message=f"User {username} deleted.")
        except User.DoesNotExist:
            return error("User not found.", status_code=status.HTTP_404_NOT_FOUND)


class InvitationTokenView(generics.GenericAPIView):
    """Admin sends an invitation token to invite a new moderator/staff."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        user_role = getattr(request.user, 'role', None)
        if user_role not in ('GLOBAL_OWNER', 'TENANT_ADMIN'):
            return error("Only admins can send invitations.", status_code=status.HTTP_403_FORBIDDEN)

        email = request.data.get('email')
        name = request.data.get('name', '')
        role = request.data.get('role', 'TENANT_MODERATOR')
        tenant_id = request.data.get('tenant_id', getattr(request.user, 'tenant_id', None))

        if not email:
            return error("Email is required.", status_code=status.HTTP_400_BAD_REQUEST)

        temp_password = User.objects.make_random_password(length=12)
        username = email.split('@')[0]
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        tenant = None
        tenant_name = ''
        if tenant_id:
            try:
                tenant = Tenant.objects.get(id=tenant_id)
                tenant_name = tenant.name
            except Tenant.DoesNotExist:
                pass

        user = User.objects.create_user(
            username=username,
            email=email,
            password=temp_password,
            first_name=name or '',
            role=role if role in dict(Role.choices) else 'TENANT_MODERATOR',
            tenant=tenant,
        )

        AuditLog.objects.create(
            impersonator=request.user,
            target_user=user,
            tenant_id=str(tenant_id) if tenant_id else None,
            action=f"Invited user {email} as {role} to tenant {tenant_id}",
            ip_address=request.META.get('REMOTE_ADDR'),
            status_code=201,
        )

        EmailService.send_invitation(email, username, temp_password, tenant_name)

        return success(data={
            "username": username,
            "email": email,
            "temporary_password": temp_password,
            "role": role,
            "message": f"Invitation created and email sent to {email}.",
        })
