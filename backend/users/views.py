from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema
from .serializers import UserSerializer, RegisterSerializer
from .models import User
from .permissions import IsGlobalOwner

class RegisterView(generics.CreateAPIView):
    """
    Register a new Athlete user.
    Default role is 'ATHLETE'.
    """
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    @extend_schema(
        responses={201: UserSerializer},
        description="Creates a new athlete account in the SPORT platform."
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update the authenticated user's profile.
    """
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user

    @extend_schema(
        description="Returns the profile details of the currently logged-in user."
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

class TenantBrandingView(generics.RetrieveAPIView):
    """
    Get branding details for a specific tenant.
    Used for White-Labeling.
    """
    permission_classes = (permissions.AllowAny,)
    
    def get(self, request, tenant_id):
        from .models import Tenant
        try:
            tenant = Tenant.objects.get(id=tenant_id, is_active=True)
            return Response({
                "name": tenant.name,
                "primary_color": tenant.primary_color,
                "secondary_color": tenant.secondary_color,
                "logo_url": tenant.logo.url if tenant.logo else None
            })
        except Tenant.DoesNotExist:
            return Response({"error": "tenant not found"}, status=status.HTTP_404_NOT_FOUND)

class ImpersonateUserView(generics.GenericAPIView):
    """
    Allows a GLOBAL_OWNER to request an access token for another user
    without knowing their password. Useful for support/debugging.
    """
    permission_classes = (permissions.IsAuthenticated, IsGlobalOwner)
    queryset = User.objects.all()

    @extend_schema(
        responses={200: dict},
        description="Returns an access and refresh token for the specified user."
    )
    def post(self, request, target_user_id):
        try:
            target_user = User.objects.get(id=target_user_id)
            
            # Generate token for target_user
            refresh = RefreshToken.for_user(target_user)
            # Add impersonation claim for audit logs
            refresh['impersonated'] = True
            refresh['impersonator_id'] = request.user.id
            
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'impersonated_user': target_user.username,
                'impersonated_role': target_user.role
            })
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
