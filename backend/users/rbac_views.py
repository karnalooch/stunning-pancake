"""
RBAC API Views
===============
Endpoints for managing roles, permissions, and user-role assignments.
"""

from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .permissions import IsGlobalOwner, IsTenantAdmin
from .rbac_models import Permission, Role, UserRole
from .rbac_serializers import PermissionSerializer, RoleSerializer, UserRoleSerializer


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """List and retrieve permissions. Read-only."""

    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"])
    def by_resource(self, request):
        """Group permissions by resource."""
        resources = {}
        for perm in self.get_queryset():
            resources.setdefault(perm.resource, []).append(
                {
                    "codename": perm.codename,
                    "action": perm.action,
                    "name": perm.name,
                }
            )
        return Response(resources)


class RoleViewSet(viewsets.ModelViewSet):
    """CRUD for roles. System roles can't be deleted."""

    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsGlobalOwner]

    def perform_destroy(self, instance):
        if instance.is_system:
            raise serializers.ValidationError("System roles cannot be deleted.")
        super().perform_destroy(instance)


class UserRoleViewSet(viewsets.ModelViewSet):
    """Manage user-role assignments."""

    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [IsTenantAdmin]
    TENANT_ADMIN_ASSIGNABLE_ROLES = {"athlete", "sponsor", "tenant_moderator"}

    def get_queryset(self):
        qs = super().get_queryset()
        # Global owners see all, tenant admins see only their tenant
        if self.request.user.role == "GLOBAL_OWNER":
            return qs
        return qs.filter(tenant_id=self.request.user.tenant_id)

    def _tenant_admin_values(self, serializer):
        """Return tenant-safe assignment values for a legacy tenant admin."""
        actor = self.request.user
        if actor.role == "GLOBAL_OWNER":
            return {}

        if not actor.tenant_id:
            raise serializers.ValidationError("Tenant admin has no tenant.")

        target_user = serializer.validated_data.get("user")
        target_role = serializer.validated_data.get("role")
        if target_user is None and serializer.instance is not None:
            target_user = serializer.instance.user
        if target_role is None and serializer.instance is not None:
            target_role = serializer.instance.role

        if target_user is None or target_user.tenant_id != actor.tenant_id:
            raise serializers.ValidationError("User must belong to your tenant.")
        if target_role is None or target_role.slug not in self.TENANT_ADMIN_ASSIGNABLE_ROLES:
            raise serializers.ValidationError("Role cannot be assigned by a tenant admin.")

        return {"tenant_id": actor.tenant_id, "tenant_scoped": True}

    def perform_create(self, serializer):
        serializer.save(granted_by=self.request.user, **self._tenant_admin_values(serializer))

    def perform_update(self, serializer):
        serializer.save(**self._tenant_admin_values(serializer))

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        """Revoke a role assignment."""
        assignment = self.get_object()
        assignment.delete()
        return Response({"status": "revoked"})

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def my_roles(self, request):
        """Get current user's role assignments (any authenticated user)."""
        qs = UserRole.objects.filter(user=request.user)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
