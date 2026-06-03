"""
RBAC URL Routing
=================
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .rbac_views import PermissionViewSet, RoleViewSet, UserRoleViewSet

router = DefaultRouter()
router.register(r"permissions", PermissionViewSet, basename="rbac-permission")
router.register(r"roles", RoleViewSet, basename="rbac-role")
router.register(r"user-roles", UserRoleViewSet, basename="rbac-user-role")

urlpatterns = [
    path("", include(router.urls)),
]
