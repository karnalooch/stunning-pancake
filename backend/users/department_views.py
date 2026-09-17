"""
Department API Views
=====================
Endpoints for managing departments and user assignments.
"""

from django.conf import settings
from django.db.models import Count
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .audit import record_audit_event
from .department_serializers import (
    DepartmentSerializer,
    UserDepartmentSerializer,
)
from .departments import Department, UserDepartment
from .models import User


def _user_tenant_id(user):
    """Approved tenant scope for a request user (``None`` means fail-closed)."""
    return getattr(user, "tenant_id", None)


class DepartmentAccessPermission(permissions.BasePermission):
    """Action-scoped RBAC for department and user-department administration.

    * mutations (create/update/partial_update/destroy/assign/remove) require
      ``GLOBAL_OWNER`` or a tenant-bound ``TENANT_ADMIN``;
    * ``self_join`` keeps the documented roles (no ``SPONSOR``);
    * every other (read) action is open to authenticated users and the tenant
      scope is applied in the queryset/serializer, never by the client.
    """

    ADMIN_MUTATION_ACTIONS = {
        "create",
        "update",
        "partial_update",
        "destroy",
        "assign",
        "remove",
    }
    SELF_JOIN_ROLES = ("ATHLETE", "TENANT_MODERATOR", "TENANT_ADMIN", "GLOBAL_OWNER")

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        role = getattr(user, "role", None)
        action = getattr(view, "action", None)
        if action in self.ADMIN_MUTATION_ACTIONS:
            if role == "GLOBAL_OWNER":
                return True
            return role == "TENANT_ADMIN" and bool(_user_tenant_id(user))
        if action == "self_join":
            return role in self.SELF_JOIN_ROLES
        return True


class DepartmentViewSet(viewsets.ModelViewSet):
    """CRUD for departments. Scoped to user's tenant."""

    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated, DepartmentAccessPermission]

    def get_queryset(self):
        if not getattr(settings, "DEPARTMENTS_ENABLED", True):
            return Department.objects.none()
        qs = (
            super()
            .get_queryset()
            .filter(is_active=True)
            .annotate(_member_count=Count("userdepartment", distinct=True))
        )
        # Global owners see all; tenant-bound roles see only their own tenant.
        if self.request.user.role == "GLOBAL_OWNER":
            return qs
        tenant_id = _user_tenant_id(self.request.user)
        if not tenant_id:
            return Department.objects.none()
        return qs.filter(tenant_id=tenant_id)

    def perform_create(self, serializer):
        # Tenant admins can never choose/override the tenant; it is always the
        # authenticated user's tenant. Global owners must pick an existing one.
        if self.request.user.role != "GLOBAL_OWNER":
            serializer.save(tenant_id=self.request.user.tenant_id)
        else:
            serializer.save()

    @action(detail=False, methods=["get"])
    def tree(self, request):
        """Get department hierarchy as a tree (single query + in-memory build)."""
        qs = self.get_queryset()

        by_parent: dict[int | None, list] = {}
        direct_counts: dict[int, int] = {}
        for dept in qs.only("id", "name", "department_type", "parent_id"):
            direct_counts[dept.id] = int(getattr(dept, "_member_count", 0) or 0)
            by_parent.setdefault(dept.parent_id, []).append(dept)

        def build_node(dept) -> dict:
            child_nodes = by_parent.get(dept.id, [])
            children = [build_node(child) for child in child_nodes]
            full_count = direct_counts.get(dept.id, 0) + sum(c["member_count"] for c in children)
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
        """Get active departments the current user is actually a member of.

        Tenant-bound users never see a department outside their tenant, even if
        an inconsistent historical ``UserDepartment`` row exists. ``GLOBAL_OWNER``
        receives only their own memberships, never the whole platform.
        """
        user = request.user
        links = UserDepartment.objects.filter(user=user, department__is_active=True).select_related(
            "department"
        )
        if getattr(user, "role", None) != "GLOBAL_OWNER":
            tenant_id = _user_tenant_id(user)
            if not tenant_id:
                return Response([])
            links = links.filter(department__tenant_id=tenant_id)
        departments = [link.department for link in links]
        serializer = self.get_serializer(departments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def users(self, request, pk=None):
        """Get all users in a department (scoped to the department's tenant)."""
        department = self.get_object()
        users = User.objects.filter(departments=department, tenant_id=department.tenant_id)
        from .serializers import UserSerializer

        return Response(UserSerializer(users, many=True).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        """Assign a user to this department. Cross-tenant relations are refused."""
        department = self.get_object()
        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"error": "user_id required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id, tenant_id=department.tenant_id)
        except (User.DoesNotExist, TypeError, ValueError):
            return Response(
                {"error": "user not found in department tenant"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        UserDepartment.objects.get_or_create(user=user, department=department)
        return Response({"status": "assigned"})

    @action(detail=True, methods=["post"], url_path="self-join")
    def self_join(self, request, pk=None):
        """Assign authenticated user to selected department (tenant-scoped)."""
        user = request.user
        user_tenant = _user_tenant_id(user)
        if not user_tenant:
            return Response({"error": "tenant_context_required"}, status=status.HTTP_403_FORBIDDEN)
        department = self.get_object()
        if str(user_tenant) != str(department.tenant_id):
            return Response({"error": "cross_tenant_join_denied"}, status=status.HTTP_403_FORBIDDEN)

        membership, created = UserDepartment.objects.get_or_create(user=user, department=department)
        if created:
            record_audit_event(
                actor=user,
                target_user=user,
                tenant_id=department.tenant_id,
                action="department_membership.self_joined",
                status_code=200,
                request=request,
                details={"department_id": department.id, "membership_id": membership.id},
            )
        return Response({"status": "joined", "department_id": department.id})

    @action(detail=True, methods=["post"])
    def remove(self, request, pk=None):
        """Remove a user from this department within the same tenant scope."""
        department = self.get_object()
        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"error": "user_id required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id, tenant_id=department.tenant_id)
        except (User.DoesNotExist, TypeError, ValueError):
            return Response(
                {"error": "user not found in department tenant"},
                status=status.HTTP_404_NOT_FOUND,
            )
        UserDepartment.objects.filter(user=user, department=department).delete()
        return Response({"status": "removed"})


class UserDepartmentViewSet(viewsets.ModelViewSet):
    """Manage user-department assignments (tenant-scoped)."""

    queryset = UserDepartment.objects.all()
    serializer_class = UserDepartmentSerializer
    permission_classes = [permissions.IsAuthenticated, DepartmentAccessPermission]

    def get_queryset(self):
        if not getattr(settings, "DEPARTMENTS_ENABLED", True):
            return UserDepartment.objects.none()
        qs = super().get_queryset().select_related("user", "department")
        user = self.request.user
        if getattr(user, "role", None) == "GLOBAL_OWNER":
            return qs
        tenant_id = _user_tenant_id(user)
        if not tenant_id:
            return UserDepartment.objects.none()
        return qs.filter(department__tenant_id=tenant_id)
