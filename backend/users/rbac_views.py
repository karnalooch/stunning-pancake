"""
RBAC API Views
===============
Endpoints for managing roles, permissions, and user-role assignments.
"""

from rest_framework import viewsets, permissions, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .rbac_models import Permission, Role, RolePermission, UserRole
from .rbac_serializers import PermissionSerializer, RoleSerializer, UserRoleSerializer
from .permissions import IsGlobalOwner, IsTenantAdmin


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

    def get_queryset(self):
        qs = super().get_queryset()
        # Global owners see all, tenant admins see only their tenant
        if self.request.user.role == "GLOBAL_OWNER":
            return qs
        return qs.filter(tenant_id=self.request.user.tenant_id)

    def perform_create(self, serializer):
        serializer.save(granted_by=self.request.user)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        """Revoke a role assignment."""
        assignment = self.get_object()
        assignment.delete()
        return Response({"status": "revoked"})

    @action(detail=False, methods=["get"])
    def my_roles(self, request):
        """Get current user's role assignments."""
        qs = UserRole.objects.filter(user=request.user)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
