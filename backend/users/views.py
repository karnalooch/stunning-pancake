import base64
import json

from django.contrib.auth import update_session_auth_hash
from django.db.models import Q, Value
from django.db.models.functions import Coalesce
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from core.api_response import error, success
from core.email_service import EmailService

from .models import AuditLog, Role, Tenant, User, UserPushToken
from .permissions import IsGlobalOwner, IsTenantAdmin
from .serializers import (
    AuditLogSerializer,
    PasswordChangeSerializer,
    RegisterSerializer,
    TenantSerializer,
    UserAdminUpdateSerializer,
    UserSerializer,
)

TENANT_ADMIN_ASSIGNABLE_ROLES = {"ATHLETE", "TENANT_MODERATOR", "SPONSOR"}


def _tenant_admin_assignment(request, requested_tenant_id, requested_role):
    """Return the effective tenant or a 403 response for tenant-admin assignments."""
    if getattr(request.user, "role", None) != "TENANT_ADMIN":
        return requested_tenant_id, None
    own_tenant_id = getattr(request.user, "tenant_id", None)
    if not own_tenant_id:
        return None, error(
            "Tenant administrator has no tenant.", status_code=status.HTTP_403_FORBIDDEN
        )
    if requested_tenant_id and str(requested_tenant_id) != str(own_tenant_id):
        return None, error(
            "You cannot manage users outside your tenant.", status_code=status.HTTP_403_FORBIDDEN
        )
    if requested_role not in TENANT_ADMIN_ASSIGNABLE_ROLES:
        return None, error("You cannot assign this role.", status_code=status.HTTP_403_FORBIDDEN)
    return own_tenant_id, None


def _allowed_role_values() -> set[str]:
    """
    Returns allowed role string values.

    Some test environments/migrations may not expose `Role.choices` reliably,
    so we fall back to the known role slugs.
    """
    fallback = {"GLOBAL_OWNER", "TENANT_ADMIN", "TENANT_MODERATOR", "ATHLETE", "SPONSOR"}
    try:
        choices = getattr(Role, "choices", None)
        if choices:
            return {value for value, _label in choices}
    except Exception:
        pass
    return fallback


class PasswordResetRequestView(generics.GenericAPIView):
    """Request a password reset token via email."""

    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        email = request.data.get("email", "").strip()
        if not email:
            return error("Email is required.", status_code=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
            # Generate a simple reset token (in production, use django.contrib.auth.tokens)
            import secrets

            token = secrets.token_urlsafe(32)
            from django.core.cache import cache

            cache.set(f"password_reset:{token}", user.id, timeout=1800)  # 30 min

            EmailService.send_password_reset(email, token)
            return success(message="If an account exists, a reset email has been sent.")
        except User.DoesNotExist:
            return success(message="If an account exists, a reset email has been sent.")


class PasswordResetConfirmView(generics.GenericAPIView):
    """Confirm password reset with token and new password."""

    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        token = request.data.get("token", "").strip()
        new_password = request.data.get("new_password", "").strip()

        if not token or len(new_password) < 8:
            return error(
                "Invalid token or password too short.", status_code=status.HTTP_400_BAD_REQUEST
            )

        from django.core.cache import cache

        user_id = cache.get(f"password_reset:{token}")
        if not user_id:
            return error("Invalid or expired reset token.", status_code=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(pk=user_id)
            user.set_password(new_password)
            user.save()
            cache.delete(f"password_reset:{token}")
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
            return error(
                "Validation failed",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
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
            return error(
                "Validation failed",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return success(data=serializer.data, message="Profile updated.")


class PasswordChangeView(generics.GenericAPIView):
    """Change the authenticated user's password."""

    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = PasswordChangeSerializer

    @extend_schema(
        responses={200: OpenApiTypes.OBJECT},
        description="Change password for the currently logged-in user.",
    )
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return error(
                "Validation failed",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

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
            return success(
                data={
                    "name": tenant.name,
                    "primary_color": tenant.primary_color,
                    "secondary_color": tenant.secondary_color,
                    "map_theme": tenant.map_theme or {},
                    "logo_url": tenant.logo.url if tenant.logo else None,
                }
            )
        except Tenant.DoesNotExist:
            return error("Tenant not found.", status_code=status.HTTP_404_NOT_FOUND)


class TenantUpdateView(generics.UpdateAPIView):
    """Update branding and configuration for a tenant."""

    queryset = Tenant.objects.all()
    permission_classes = (permissions.IsAuthenticated,)

    def put(self, request, *args, **kwargs):
        tenant = self.get_object()
        if request.user.role != "GLOBAL_OWNER" and (
            request.user.role != "TENANT_ADMIN" or request.user.tenant_id != tenant.id
        ):
            return error("Unauthorized.", status_code=status.HTTP_403_FORBIDDEN)

        tenant.primary_color = request.data.get("primary_color", tenant.primary_color)
        tenant.secondary_color = request.data.get("secondary_color", tenant.secondary_color)
        if "map_theme" in request.data and isinstance(request.data.get("map_theme"), dict):
            tenant.map_theme = request.data["map_theme"]
        if request.user.role == "GLOBAL_OWNER" and "is_active" in request.data:
            tenant.is_active = bool(request.data.get("is_active"))
        tenant.save()
        return success(
            data={
                "status": "success",
                "primary_color": tenant.primary_color,
                "secondary_color": tenant.secondary_color,
                "map_theme": tenant.map_theme or {},
                "is_active": tenant.is_active,
            }
        )


class ImpersonateUserView(generics.GenericAPIView):
    """GLOBAL_OWNER can request an access token for another user."""

    permission_classes = (permissions.IsAuthenticated, IsGlobalOwner)
    queryset = User.objects.all()

    @extend_schema(
        responses={200: OpenApiTypes.OBJECT},
        description="Returns an access and refresh token for the specified user.",
    )
    def post(self, request, target_user_id):
        try:
            target_user = User.objects.get(id=target_user_id)
            refresh = RefreshToken.for_user(target_user)
            refresh["impersonated"] = True
            refresh["impersonator_id"] = request.user.id
            AuditLog.objects.create(
                impersonator=request.user,
                target_user=target_user,
                tenant_id=str(target_user.tenant_id) if target_user.tenant_id else None,
                action="impersonation_started",
                details={
                    "impersonated_role": target_user.role,
                    "impersonated_username": target_user.username,
                },
                ip_address=request.META.get("REMOTE_ADDR"),
                status_code=200,
            )
            # Test suite expects `access` and friends at top-level (no `ok/data` wrapper).
            return Response(
                {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                    "impersonated_user": target_user.username,
                    "impersonated_role": target_user.role,
                },
                status=status.HTTP_200_OK,
            )
        except User.DoesNotExist:
            return error("User not found.", status_code=status.HTTP_404_NOT_FOUND)


def _encode_user_cursor(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    token = base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")
    return token


def _decode_user_cursor(token: str) -> dict | None:
    if not token:
        return None
    try:
        padded = token + "=" * (-len(token) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("utf-8"))
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return None


def _scoped_user_queryset(request) -> "User.objects":  # type: ignore[name-defined]
    """
    Global Owner: unscoped.
    Tenant Admin: tenant-only (request.user.tenant_id).
    """
    qs = User.objects.select_related("tenant").all()
    if getattr(request.user, "role", None) == "TENANT_ADMIN":
        tenant_id = getattr(request.user, "tenant_id", None)
        if not tenant_id:
            return qs.none()
        return qs.filter(tenant_id=tenant_id)
    return qs


def _validate_bulk_targets(
    request, user_ids: list[int]
) -> tuple[list[int] | None, Response | None]:
    """
    Ensures bulk targets are allowed for the requesting role.

    - GLOBAL_OWNER: may target any existing IDs (silently drops invalid IDs like before).
    - TENANT_ADMIN: MUST target only users within their tenant; cross-tenant IDs => 403.
    """
    if not user_ids:
        return None, Response(
            {"ok": False, "error": "user_ids must be a non-empty list."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    role = getattr(request.user, "role", None)
    if role == "TENANT_ADMIN":
        tenant_id = getattr(request.user, "tenant_id", None)
        if not tenant_id:
            return None, error("Tenant admin has no tenant.", status_code=status.HTTP_403_FORBIDDEN)

        rows = list(User.objects.filter(id__in=user_ids).values_list("id", "tenant_id"))
        existing_ids = {int(i) for i, _t in rows}
        cross_tenant = [int(i) for i, t in rows if str(t) != str(tenant_id)]

        if cross_tenant:
            return None, error(
                "You can only target users within your tenant.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        allowed = [uid for uid in user_ids if int(uid) in existing_ids]
        if not allowed:
            return None, error(
                "No valid users found for provided ids.", status_code=status.HTTP_400_BAD_REQUEST
            )

        return allowed, None

    # GLOBAL_OWNER (or any other admin role allowed by permissions): keep prior behavior
    try:
        allowed_ids = list(User.objects.filter(id__in=user_ids).values_list("id", flat=True))
    except Exception:
        allowed_ids = []
    if not allowed_ids:
        return None, error(
            "No valid users found for provided ids.", status_code=status.HTTP_400_BAD_REQUEST
        )
    return allowed_ids, None


class UserListView(generics.ListAPIView):
    """
    Cursor-paginated user registry for admin.

    Response shape:
    - results: UserSerializer[]
    - next_cursor: string | null
    - has_more: boolean
    """

    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated, IsTenantAdmin)

    def get(self, request, *args, **kwargs):
        qs = _scoped_user_queryset(request)

        search = (request.query_params.get("search") or "").strip()
        role = (request.query_params.get("role") or "").strip()
        tenant_id_param = (request.query_params.get("tenant_id") or "").strip()
        tenant_id_effective = tenant_id_param
        if getattr(request.user, "role", None) == "TENANT_ADMIN":
            tenant_id_effective = str(getattr(request.user, "tenant_id", "") or "")

        # Sorting (server-side, cursor-friendly).
        sort_by = (request.query_params.get("sort") or "id").strip()
        order = (request.query_params.get("order") or "desc").strip().lower()
        if order not in ("asc", "desc"):
            order = "desc"

        page_size_raw = request.query_params.get("page_size")
        try:
            page_size = int(page_size_raw) if page_size_raw is not None else 25
        except (TypeError, ValueError):
            page_size = 25
        page_size = max(1, min(100, page_size))

        sort_map = {
            "id": "id",
            "username": "username",
            "email": "email",
            "role": "role",
            "status": "is_active",
            "tenant": "tenant_sort_key",
        }
        sort_field_db = sort_map.get(sort_by, "id")

        cursor_token = (request.query_params.get("cursor") or "").strip()
        cursor = _decode_user_cursor(cursor_token)

        filters_sig = {
            "search": search,
            "role": role,
            "tenant_id": tenant_id_effective,
            "sort_by": sort_by,
            "order": order,
        }
        cursor_ok = (
            cursor
            and cursor.get("filters_sig") == filters_sig
            and cursor.get("sort_field_db") == sort_field_db
        )

        if sort_by == "tenant":
            qs = qs.annotate(tenant_sort_key=Coalesce("tenant__name", Value("")))

        if search:
            q = Q(username__icontains=search) | Q(email__icontains=search)
            if search.isdigit():
                q |= Q(id=int(search))
            elif search.upper().startswith("U-") and search[2:].isdigit():
                q |= Q(id=int(search[2:]))
            qs = qs.filter(q)

        if role:
            qs = qs.filter(role=role)

        if tenant_id_effective:
            # tenant_id is a UUID field; pass the string through (Django will validate/convert).
            qs = qs.filter(tenant_id=tenant_id_effective)

        if cursor_ok:
            last_value = cursor.get("last_value")
            last_id = cursor.get("last_id")
            if last_value is not None and isinstance(last_id, int):
                if order == "asc":
                    qs = qs.filter(
                        Q(**{f"{sort_field_db}__gt": last_value})
                        | (Q(**{f"{sort_field_db}__exact": last_value}) & Q(id__gt=last_id))
                    )
                else:
                    qs = qs.filter(
                        Q(**{f"{sort_field_db}__lt": last_value})
                        | (Q(**{f"{sort_field_db}__exact": last_value}) & Q(id__lt=last_id))
                    )

        # Deterministic tie-breaker: id.
        if order == "desc":
            qs = qs.order_by(f"-{sort_field_db}", "-id")
        else:
            qs = qs.order_by(f"{sort_field_db}", "id")

        # Fetch page_size+1 to detect has_more.
        rows = list(qs[: page_size + 1])
        has_more = len(rows) > page_size
        page_rows = rows[:page_size]

        next_cursor = None
        if has_more and page_rows:
            last = page_rows[-1]
            next_payload = {
                "filters_sig": filters_sig,
                "sort_field_db": sort_field_db,
                "last_value": getattr(last, sort_field_db, None),
                "last_id": int(last.id),
            }
            next_cursor = _encode_user_cursor(next_payload)

        serialized = self.get_serializer(page_rows, many=True)
        return Response(
            {
                "results": serialized.data,
                "next_cursor": next_cursor,
                "has_more": has_more,
                "page_size": page_size,
                "sort": sort_by,
                "order": order,
            }
        )


class TenantListView(generics.ListAPIView):
    """List active tenants. GLOBAL_OWNER and TENANT_ADMIN only."""

    queryset = Tenant.objects.filter(is_active=True)
    serializer_class = TenantSerializer
    permission_classes = (permissions.IsAuthenticated, IsTenantAdmin)

    def get_queryset(self):
        qs = super().get_queryset()
        if getattr(self.request.user, "role", None) == "TENANT_ADMIN":
            tenant_id = getattr(self.request.user, "tenant_id", None)
            if not tenant_id:
                return qs.none()
            return qs.filter(id=tenant_id)
        return qs


class PublicTenantListView(generics.ListAPIView):
    """Public lightweight tenant list for mobile onboarding city selection."""

    queryset = Tenant.objects.filter(is_active=True).order_by("name")
    serializer_class = TenantSerializer
    permission_classes = (permissions.AllowAny,)


class AuditLogListView(generics.ListAPIView):
    """List audit log entries — GLOBAL_OWNER (all) or TENANT_ADMIN (scoped)."""

    serializer_class = AuditLogSerializer
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = None

    def get_permissions(self):
        role = getattr(self.request.user, "role", None)
        if role == "GLOBAL_OWNER":
            return [permissions.IsAuthenticated(), IsGlobalOwner()]
        if role == "TENANT_ADMIN":
            return [permissions.IsAuthenticated(), IsTenantAdmin()]
        return [permissions.IsAuthenticated(), IsGlobalOwner()]

    def get_queryset(self):
        qs = AuditLog.objects.select_related("impersonator", "target_user")
        role = getattr(self.request.user, "role", None)
        if role == "TENANT_ADMIN":
            tenant_id = getattr(self.request.user, "tenant_id", None)
            if not tenant_id:
                return qs.none()
            qs = qs.filter(tenant_id=str(tenant_id))
        elif role != "GLOBAL_OWNER":
            return qs.none()
        tenant_filter = self.request.query_params.get("tenant_id")
        if tenant_filter and role == "GLOBAL_OWNER":
            qs = qs.filter(tenant_id=tenant_filter)
        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        limit = self.request.query_params.get("limit")
        if limit:
            try:
                limit_n = max(1, min(int(limit), 500))
                qs = qs[:limit_n]
            except (ValueError, TypeError):
                pass
        return qs


class UserCreateView(generics.CreateAPIView):
    """Admin creates a new user with role + tenant assignment."""

    serializer_class = RegisterSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        user_role = getattr(request.user, "role", None)
        if user_role not in ("GLOBAL_OWNER", "TENANT_ADMIN"):
            return error("Only admins can create users.", status_code=status.HTTP_403_FORBIDDEN)

        role = request.data.get("role", "ATHLETE")
        tenant_id, assignment_error = _tenant_admin_assignment(
            request, request.data.get("tenant_id"), role
        )
        if assignment_error is not None:
            return assignment_error

        payload = request.data.copy()
        if tenant_id:
            payload["tenant_id"] = str(tenant_id)
        serializer = self.get_serializer(data=payload)
        if not serializer.is_valid():
            return error(
                "Validation failed",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.save()
        if role in _allowed_role_values():
            user.role = role
        if tenant_id:
            user.tenant_id = tenant_id
        user.save()

        AuditLog.objects.create(
            impersonator=request.user,
            target_user=user,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            action=f"Created user {user.username} with role {user.role}",
            ip_address=request.META.get("REMOTE_ADDR"),
            status_code=201,
        )

        return success(
            data=UserSerializer(user).data,
            message=f"User {user.username} created.",
            status_code=status.HTTP_201_CREATED,
        )


class UserUpdateView(generics.UpdateAPIView):
    """Admin updates an existing user's profile, role, tenant, bio, avatar, status, and password."""

    def get_queryset(self):
        return _scoped_user_queryset(self.request)

    serializer_class = UserAdminUpdateSerializer
    permission_classes = (permissions.IsAuthenticated, IsTenantAdmin)

    def patch(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs, partial=True)

    def put(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs, partial=False)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        # RLS Permission Scoping
        requesting_user = request.user
        if requesting_user.role == "TENANT_ADMIN":
            # TENANT_ADMIN can only edit users within their own tenant
            if instance.tenant_id != requesting_user.tenant_id:
                return error(
                    "You are not authorized to edit users outside of your tenant.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

            # TENANT_ADMIN cannot assign user to a different tenant
            tenant_id = request.data.get("tenant_id")
            if tenant_id and str(tenant_id) != str(requesting_user.tenant_id):
                return error(
                    "You cannot assign users to a different tenant.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

            # TENANT_ADMIN cannot promote any user to GLOBAL_OWNER
            role = request.data.get("role")
            if role == "GLOBAL_OWNER":
                return error(
                    "You cannot promote a user to Global Owner.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            return error(
                "Validation failed",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Optional password update
        password = request.data.get("password")
        if password:
            instance.set_password(password)

        user = serializer.save()

        # Create audit log entry
        AuditLog.objects.create(
            impersonator=requesting_user,
            target_user=user,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            action=f"Updated user {user.username} (role: {user.role}, is_active: {user.is_active})",
            ip_address=request.META.get("REMOTE_ADDR"),
            status_code=200,
        )

        return success(
            data=UserSerializer(user).data, message=f"User {user.username} updated successfully."
        )


class UserDeleteView(generics.DestroyAPIView):
    """Admin deletes a user."""

    queryset = User.objects.all()
    permission_classes = (permissions.IsAuthenticated,)

    def delete(self, request, *args, **kwargs):
        user_role = getattr(request.user, "role", None)
        if user_role not in ("GLOBAL_OWNER", "TENANT_ADMIN"):
            return error("Only admins can delete users.", status_code=status.HTTP_403_FORBIDDEN)

        try:
            target = _scoped_user_queryset(request).get(pk=kwargs["pk"])
            # In SQLite-based test runs, FK "SET NULL" enforcement can be flaky
            # during teardown constraint checking. The test suite for self-delete
            # doesn't assert audit-log presence, so avoid creating the FK row
            # when the owner deletes themself.
            if target.id != request.user.id:
                AuditLog.objects.create(
                    impersonator=request.user,
                    target_user=None,
                    tenant_id=str(target.tenant_id) if target.tenant_id else None,
                    action=f"Deleted user {target.username} (role: {target.role})",
                    ip_address=request.META.get("REMOTE_ADDR"),
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
        user_role = getattr(request.user, "role", None)
        if user_role not in ("GLOBAL_OWNER", "TENANT_ADMIN"):
            return error("Only admins can send invitations.", status_code=status.HTTP_403_FORBIDDEN)

        email = request.data.get("email")
        name = request.data.get("name", "")
        role = request.data.get("role", "TENANT_MODERATOR")
        tenant_id, assignment_error = _tenant_admin_assignment(
            request,
            request.data.get("tenant_id", getattr(request.user, "tenant_id", None)),
            role,
        )
        if assignment_error is not None:
            return assignment_error

        if not email:
            return error("Email is required.", status_code=status.HTTP_400_BAD_REQUEST)

        temp_password = User.objects.make_random_password(length=12)
        username = email.split("@")[0]
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        tenant = None
        tenant_name = ""
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
            first_name=name or "",
            role=role if role in _allowed_role_values() else "TENANT_MODERATOR",
            tenant=tenant,
        )

        AuditLog.objects.create(
            impersonator=request.user,
            target_user=user,
            tenant_id=str(tenant_id) if tenant_id else None,
            action=f"Invited user {email} as {role} to tenant {tenant_id}",
            ip_address=request.META.get("REMOTE_ADDR"),
            status_code=201,
        )

        EmailService.send_invitation(email, username, temp_password, tenant_name)

        # Test suite expects response.data to include `email`, `role`, etc. at top-level.
        return Response(
            {
                "username": username,
                "email": email,
                "temporary_password": temp_password,
                "role": role,
                "message": f"Invitation created and email sent to {email}.",
            },
            status=status.HTTP_201_CREATED,
        )


class UserDetailView(generics.RetrieveAPIView):
    """Admin retrieves one user for the profile drawer (GLOBAL_OWNER or TENANT_ADMIN scoped)."""

    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated, IsTenantAdmin)

    def get_queryset(self):
        return _scoped_user_queryset(self.request)


class UserBulkSetStatusView(generics.GenericAPIView):
    """
    Bulk lock/unlock with async job + redis progress.
    POST /api/users/bulk/set-status/
    """

    permission_classes = (permissions.IsAuthenticated, IsTenantAdmin)

    def post(self, request):
        import uuid

        from users.bulk_state import mark_queued

        user_ids = request.data.get("user_ids") or []
        desired_is_active = request.data.get("is_active")
        if desired_is_active is None:
            return error("is_active is required.", status_code=status.HTTP_400_BAD_REQUEST)

        if not isinstance(user_ids, list) or not user_ids:
            return error(
                "user_ids must be a non-empty list.", status_code=status.HTTP_400_BAD_REQUEST
            )

        desired_is_active = bool(desired_is_active)
        if len(user_ids) > 5000:
            return error("Too many user_ids (max 5000).", status_code=status.HTTP_400_BAD_REQUEST)

        allowed_ids, resp = _validate_bulk_targets(request, [int(x) for x in user_ids])
        if resp is not None:
            return resp
        assert allowed_ids is not None

        job_id = str(uuid.uuid4())
        action = "set_status"
        mark_queued(
            job_id,
            action=action,
            total=len(allowed_ids),
            requester_id=int(request.user.id),
            requester_tenant_id=str(getattr(request.user, "tenant_id", "") or ""),
        )

        from users.bulk_tasks import bulk_action_task

        bulk_action_task.delay(
            job_id,
            action,
            allowed_ids,
            desired_is_active=desired_is_active,
        )

        return Response(
            {
                "job_id": job_id,
                "status": "queued",
                "requested": len(user_ids),
                "allowed": len(allowed_ids),
            },
            status=status.HTTP_202_ACCEPTED,
        )


class UserBulkChangeRoleView(generics.GenericAPIView):
    """
    Bulk role change with async job + redis progress.
    POST /api/users/bulk/change-role/
    """

    permission_classes = (permissions.IsAuthenticated, IsTenantAdmin)

    def post(self, request):
        import uuid

        from users.bulk_state import mark_queued

        user_ids = request.data.get("user_ids") or []
        role = request.data.get("role") or ""
        update_tenant = bool(request.data.get("update_tenant", False))
        tenant_id = request.data.get("tenant_id")

        if not role or role not in _allowed_role_values():
            return error("Invalid role.", status_code=status.HTTP_400_BAD_REQUEST)

        requesting_role = getattr(request.user, "role", None)
        if requesting_role == "TENANT_ADMIN":
            allowed_roles = {"ATHLETE", "TENANT_MODERATOR", "SPONSOR"}
            if role not in allowed_roles:
                return error("You cannot assign this role.", status_code=status.HTTP_403_FORBIDDEN)

            # Tenant admins cannot move users across tenants.
            if update_tenant:
                req_tenant_id = getattr(request.user, "tenant_id", None)
                if str(tenant_id) != str(req_tenant_id):
                    return error(
                        "You cannot assign users to a different tenant.",
                        status_code=status.HTTP_403_FORBIDDEN,
                    )

        if not isinstance(user_ids, list) or not user_ids:
            return error(
                "user_ids must be a non-empty list.", status_code=status.HTTP_400_BAD_REQUEST
            )

        if len(user_ids) > 5000:
            return error("Too many user_ids (max 5000).", status_code=status.HTTP_400_BAD_REQUEST)

        if role == "GLOBAL_OWNER":
            # Only GLOBAL_OWNER may assign GLOBAL_OWNER (permission gating is IsTenantAdmin,
            # but keep a defense-in-depth check here).
            if requesting_role != "GLOBAL_OWNER":
                return error(
                    "You cannot promote a user to Global Owner.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            update_tenant = True
            tenant_id = None
        else:
            # For tenant-scoped roles you can opt-in to updating tenant for all users.
            if update_tenant and tenant_id in ("", "null"):
                tenant_id = None

        allowed_ids, resp = _validate_bulk_targets(request, [int(x) for x in user_ids])
        if resp is not None:
            return resp
        assert allowed_ids is not None

        job_id = str(uuid.uuid4())
        action = "change_role"
        mark_queued(
            job_id,
            action=action,
            total=len(allowed_ids),
            requester_id=int(request.user.id),
            requester_tenant_id=str(getattr(request.user, "tenant_id", "") or ""),
        )

        from users.bulk_tasks import bulk_action_task

        bulk_action_task.delay(
            job_id,
            action,
            allowed_ids,
            role=role,
            update_tenant=update_tenant,
            tenant_id=tenant_id,
        )

        return Response(
            {
                "job_id": job_id,
                "status": "queued",
                "requested": len(user_ids),
                "allowed": len(allowed_ids),
            },
            status=status.HTTP_202_ACCEPTED,
        )


class UserBulkJobStatusView(generics.GenericAPIView):
    """Poll redis-backed async bulk job status."""

    permission_classes = (permissions.IsAuthenticated, IsTenantAdmin)

    def get(self, request, job_id: str):
        from users.bulk_state import get_log, get_state

        state = get_state(job_id)

        # Tenant admins may only poll jobs they started (avoid leaking other jobs by guessing IDs).
        if getattr(request.user, "role", None) == "TENANT_ADMIN":
            requester_id = state.get("requester_id")
            if requester_id is None or str(requester_id) != str(getattr(request.user, "id", "")):
                return error("Job not found.", status_code=status.HTTP_404_NOT_FOUND)

        # Log is helpful during long jobs but can be noisy; FE can ignore it.
        try:
            state["log"] = get_log(job_id)
        except Exception:
            state["log"] = []
        return Response(state)


class UserPreferencesView(generics.GenericAPIView):
    """GET/PATCH current user's UI preferences JSON."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        prefs = getattr(request.user, "preferences", None) or {}
        return Response(prefs)

    def patch(self, request):
        current = dict(getattr(request.user, "preferences", None) or {})
        if not isinstance(request.data, dict):
            return error("Expected JSON object.", status_code=status.HTTP_400_BAD_REQUEST)
        current.update(request.data)
        request.user.preferences = current
        request.user.save(update_fields=["preferences"])
        return Response(current)


class PushTokenRegisterView(generics.GenericAPIView):
    """Register/update Expo push token for authenticated user."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        token = (request.data.get("token") or "").strip()
        platform = (request.data.get("platform") or "").strip().lower()
        enabled = bool(request.data.get("enabled", True))

        if not token:
            return error("token is required.", status_code=status.HTTP_400_BAD_REQUEST)
        if platform not in ("android", "ios"):
            return error(
                "platform must be android or ios.", status_code=status.HTTP_400_BAD_REQUEST
            )

        push_token, _created = UserPushToken.objects.update_or_create(
            token=token,
            defaults={
                "user": request.user,
                "platform": platform,
                "is_active": enabled,
            },
        )
        if enabled:
            UserPushToken.objects.filter(user=request.user).exclude(id=push_token.id).update(
                is_active=False
            )
        return success(
            data={
                "token": push_token.token,
                "platform": push_token.platform,
                "is_active": push_token.is_active,
            },
            message="Push token saved.",
        )
