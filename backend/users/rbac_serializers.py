"""
RBAC Serializers
=================
Serializers for role and permission management API.
"""
from rest_framework import serializers
from .rbac_models import Permission, Role, RolePermission, UserRole
from .models import User, Tenant


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'codename', 'name', 'resource', 'action', 'description']


class RolePermissionSerializer(serializers.ModelSerializer):
    permission = PermissionSerializer(read_only=True)
    permission_id = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(), source='permission', write_only=True
    )

    class Meta:
        model = RolePermission
        fields = ['id', 'permission', 'permission_id', 'tenant_scoped']


class RoleSerializer(serializers.ModelSerializer):
    permissions = RolePermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(), many=True, write_only=True, source='permissions'
    )

    class Meta:
        model = Role
        fields = ['id', 'slug', 'name', 'description', 'is_system', 'permissions', 'permission_ids', 'created_at']
        read_only_fields = ['is_system', 'created_at']


class UserRoleSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', write_only=True
    )
    user = serializers.StringRelatedField(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )
    tenant = serializers.StringRelatedField(read_only=True)
    tenant_id = serializers.PrimaryKeyRelatedField(
        queryset=Tenant.objects.all(), source='tenant', write_only=True, required=False, allow_null=True
    )
    granted_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = UserRole
        fields = [
            'id', 'user', 'user_id', 'role', 'role_id',
            'tenant', 'tenant_id', 'expires_at', 'granted_by', 'created_at'
        ]
        read_only_fields = ['granted_by', 'created_at']
