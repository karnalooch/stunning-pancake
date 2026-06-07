"""
Department API Views
=====================
Endpoints for managing departments and user assignments.
"""

from django.conf import settings
from django.db.models import Count
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .departments import Department, UserDepartment
from .department_serializers import (
    DepartmentSerializer,
    DepartmentTreeSerializer,
    UserDepartmentSerializer,
)
from .models import User
from .permissions import HasPermission, IsTenantAdmin


class DepartmentViewSet(viewsets.ModelViewSet):
    """CRUD for departments. Scoped to user's tenant."""

    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if not getattr(settings, "DEPARTMENTS_ENABLED", True):
            return Department.objects.none()
        qs = super().get_queryset().filter(is_active=True).annotate(
            _member_count=Count("userdepartment", distinct=True)
        )
        # Global owners see all, tenant admins see their tenant
        if self.request.user.role == "GLOBAL_OWNER":
            return qs
        return qs.filter(tenant_id=self.request.user.tenant_id)

    def perform_create(self, serializer):
        # Auto-assign tenant for non-global owners
        if self.request.user.role != "GLOBAL_OWNER":
            serializer.save(tenant_id=self.request.user.tenant_id)
        else:
            serializer.save()

    @action(detail=False, methods=["get"])
    def tree(self, request):
        """Get department hierarchy as a tree (single query + in-memory build)."""
        qs = self.get_queryset()
        if request.user.role != "GLOBAL_OWNER":
            qs = qs.filter(tenant_id=request.user.tenant_id)

        by_parent: dict[int | None, list] = {}
        direct_counts: dict[int, int] = {}
        for dept in qs.only("id", "name", "department_type", "parent_id"):
            direct_counts[dept.id] = int(getattr(dept, "_member_count", 0) or 0)
            by_parent.setdefault(dept.parent_id, []).append(dept)

        def build_node(dept) -> dict:
            child_nodes = by_parent.get(dept.id, [])
            children = [build_node(child) for child in child_nodes]
            full_count = direct_counts.get(dept.id, 0) + sum(
                c["member_count"] for c in children
            )
            return {
                "id": dept.id,
                "name": dept.name,
                "department_type": dept.department_type,
                "member_count": full_count,
                "children": children,
            }

        roots = by_parent.get(None, [])
        return Response([build_node(root) for root in roots])

    @action(detail=False, methods=["get"])
    def my(self, request):
        """Get departments the current user belongs to."""
        departments = Department.objects.filter(members=request.user, is_active=True)
        serializer = self.get_serializer(departments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def users(self, request, pk=None):
        """Get all users in a department."""
        department = self.get_object()
        users = User.objects.filter(departments=department)
        from .serializers import UserSerializer

        return Response(UserSerializer(users, many=True).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        """Assign a user to this department."""
        department = self.get_object()
        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"error": "user_id required"}, status=status.HTTP_400_BAD_REQUEST)
        user = get_object_or_404(User, id=user_id)
        UserDepartment.objects.get_or_create(user=user, department=department)
        return Response({"status": "assigned"})

    @action(detail=True, methods=["post"])
    def remove(self, request, pk=None):
        """Remove a user from this department."""
        department = self.get_object()
        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"error": "user_id required"}, status=status.HTTP_400_BAD_REQUEST)
        UserDepartment.objects.filter(user_id=user_id, department=department).delete()
        return Response({"status": "removed"})


class UserDepartmentViewSet(viewsets.ModelViewSet):
    """Manage user-department assignments."""

    queryset = UserDepartment.objects.all()
    serializer_class = UserDepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if not getattr(settings, "DEPARTMENTS_ENABLED", True):
            return UserDepartment.objects.none()
        qs = super().get_queryset()
        if self.request.user.role == "GLOBAL_OWNER":
            return qs
        return qs.filter(department__tenant_id=self.request.user.tenant_id)
