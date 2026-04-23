from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User objects.
    Includes role-based visibility and tenant identification.
    """
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'tenant_id', 'avatar', 'bio')
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

