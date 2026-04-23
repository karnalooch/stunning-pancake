from rest_framework import generics, permissions, status
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .serializers import UserSerializer, RegisterSerializer
from .models import User

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
