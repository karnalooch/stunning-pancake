from rest_framework import viewsets, permissions
from .models import FeatureFlag
from .serializers import FeatureFlagSerializer


class FeatureFlagViewSet(viewsets.ModelViewSet):
    queryset = FeatureFlag.objects.all()
    serializer_class = FeatureFlagSerializer
    permission_classes = [permissions.IsAuthenticated]
