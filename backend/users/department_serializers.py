"""
Department Serializers
=======================
Serializers for department management API.
"""

from rest_framework import serializers

from .departments import Department, UserDepartment
from .models import User


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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        role = getattr(user, "role", None)
        if role == "GLOBAL_OWNER":
            # Global owners keep explicit, validated tenant selection.
            return
        # Tenant-bound roles can never write/override the tenant, and may only
        # reference relations from within their own tenant.
        self.fields["tenant"].read_only = True
        tenant_id = getattr(user, "tenant_id", None)
        if tenant_id:
            self.fields["parent"].queryset = Department.objects.filter(tenant_id=tenant_id)
            self.fields["moderator"].queryset = User.objects.filter(tenant_id=tenant_id)
        else:
            self.fields["parent"].queryset = Department.objects.none()
            self.fields["moderator"].queryset = User.objects.none()

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        role = getattr(user, "role", None)

        # Resolve the tenant this write targets; it is never taken from an
        # untrusted field for tenant-bound roles.
        if role == "GLOBAL_OWNER":
            tenant = attrs.get("tenant") or getattr(self.instance, "tenant", None)
            if tenant is None:
                raise serializers.ValidationError({"tenant": "tenant is required."})
        else:
            tenant = getattr(self.instance, "tenant", None) or getattr(user, "tenant", None)
            if tenant is None:
                raise serializers.ValidationError({"tenant": "tenant scope required."})

        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        if parent is not None and str(parent.tenant_id) != str(tenant.id):
            raise serializers.ValidationError({"parent": "parent must belong to the same tenant."})

        moderator = attrs.get("moderator", getattr(self.instance, "moderator", None))
        if moderator is not None and str(moderator.tenant_id) != str(tenant.id):
            raise serializers.ValidationError(
                {"moderator": "moderator must belong to the same tenant."}
            )
        return attrs

    def get_member_count(self, obj):
        annotated = getattr(obj, "_member_count", None)
        if annotated is not None:
            return int(annotated)
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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        role = getattr(user, "role", None)
        if role == "GLOBAL_OWNER":
            return
        # Restrict related lookups to the requester's tenant. A tenant-bound
        # role without a tenant gets an empty scope (fail-closed).
        tenant_id = getattr(user, "tenant_id", None)
        if tenant_id:
            self.fields["user_id"].queryset = User.objects.filter(tenant_id=tenant_id)
            self.fields["department_id"].queryset = Department.objects.filter(tenant_id=tenant_id)
        else:
            self.fields["user_id"].queryset = User.objects.none()
            self.fields["department_id"].queryset = Department.objects.none()

    def validate(self, attrs):
        user = attrs.get("user") or getattr(self.instance, "user", None)
        department = attrs.get("department") or getattr(self.instance, "department", None)
        if user is not None and department is not None:
            if str(getattr(user, "tenant_id", None)) != str(getattr(department, "tenant_id", None)):
                raise serializers.ValidationError(
                    "user and department must belong to the same tenant."
                )
        return attrs
