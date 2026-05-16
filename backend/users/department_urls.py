"""
Department URL Routing
=======================
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .department_views import DepartmentViewSet, UserDepartmentViewSet

router = DefaultRouter()
router.register(r'', DepartmentViewSet, basename='department')
router.register(r'user-departments', UserDepartmentViewSet, basename='user-department')

urlpatterns = [
    path('', include(router.urls)),
]
