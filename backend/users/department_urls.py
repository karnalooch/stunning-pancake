"""
Department URL Routing
=======================
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .department_views import DepartmentViewSet, UserDepartmentViewSet

router = DefaultRouter()
# Register the more specific ``user-departments`` prefix first: otherwise the
# catch-all ``<pk>`` detail route of the department viewset shadows it.
router.register(r"user-departments", UserDepartmentViewSet, basename="user-department")
router.register(r"", DepartmentViewSet, basename="department")

urlpatterns = [
    path("", include(router.urls)),
]
