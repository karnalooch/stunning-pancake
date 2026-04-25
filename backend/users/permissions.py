from rest_framework import permissions
from .models import Role

class IsGlobalOwner(permissions.BasePermission):
    """
    Requires the user to have the GLOBAL_OWNER role.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Role.GLOBAL_OWNER

class IsTenantAdmin(permissions.BasePermission):
    """
    Requires the user to have the TENANT_ADMIN role.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Role.TENANT_ADMIN
        
    def has_object_permission(self, request, view, obj):
        # The object being accessed must belong to the admin's tenant.
        # Ensure the object has a `tenant_id` attribute.
        if hasattr(obj, 'tenant_id'):
            return obj.tenant_id == request.user.tenant_id
        return False

class IsTenantModerator(permissions.BasePermission):
    """
    Requires the user to have at least TENANT_MODERATOR role.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in [Role.TENANT_ADMIN, Role.TENANT_MODERATOR]

    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'tenant_id'):
            return obj.tenant_id == request.user.tenant_id
        return False

class IsSponsor(permissions.BasePermission):
    """
    Requires the user to have the SPONSOR role.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Role.SPONSOR
