"""
Department Serializers
=======================
Serializers for department management API.
"""

from rest_framework import serializers
from .departments import Department, UserDepartment
from .models import User, Tenant


class DepartmentSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    moderator_name = serializers.CharField(source="moderator.username", read_only=True)
    member_count = serializers.SerializerMethodField()
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)

    class Meta:
        model = Department
        fields = [
            "id",
            "name",
            "tenant",
            "tenant_name",
            "parent",
            "parent_name",
            "moderator",
            "moderator_name",
            "department_type",
            "description",
            "is_active",
            "member_count",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_member_count(self, obj):
        return obj.get_member_count()


class DepartmentTreeSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ["id", "name", "department_type", "member_count", "children"]

    def get_children(self, obj):
        children = obj.children.filter(is_active=True)
        return DepartmentTreeSerializer(children, many=True).data

    def get_member_count(self, obj):
        return obj.get_full_member_count()


class UserDepartmentSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="user", write_only=True
    )
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), source="department", write_only=True
    )

    class Meta:
        model = UserDepartment
        fields = ["id", "user", "user_id", "department", "department_id", "joined_at"]
        read_only_fields = ["joined_at"]
