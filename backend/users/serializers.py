from rest_framework import serializers
from .models import User, Tenant, AuditLog

class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ('id', 'name', 'primary_color', 'secondary_color', 'is_active')

class AuditLogSerializer(serializers.ModelSerializer):
    """
    Serializer for AuditLog entries.
    Includes nested username fields for readability.
    """
    impersonator_username = serializers.CharField(source='impersonator.username', read_only=True, default=None)
    target_user_username = serializers.CharField(source='target_user.username', read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User objects.
    Includes role-based visibility and tenant identification.
    """
    tenant_name = serializers.CharField(source='tenant.name', read_only=True, default='')

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'tenant_id', 'tenant_name', 'avatar', 'bio')
        read_only_fields = ('id', 'role')

class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.
    Ensures safe creation of new Athlete accounts.
    """
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'tenant_id')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            tenant_id=validated_data.get('tenant_id', ''),
            role='ATHLETE' # Default role for new registrations
        )
        return user

