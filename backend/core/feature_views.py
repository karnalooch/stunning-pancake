from rest_framework import permissions, viewsets

from users.permissions import IsGlobalOwner

from .models import FeatureFlag
from .serializers import FeatureFlagSerializer


class FeatureFlagViewSet(viewsets.ModelViewSet):
    queryset = FeatureFlag.objects.all()
    serializer_class = FeatureFlagSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsGlobalOwner()]
