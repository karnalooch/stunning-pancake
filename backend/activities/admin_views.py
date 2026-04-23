from rest_framework import generics, permissions
from .models import Activity
from .serializers import ActivitySerializer

class GlobalActivityListView(generics.ListAPIView):
    """
    List all activities for Global Administrators.
    """
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        if self.request.user.role == 'GLOBAL_ADMIN' or self.request.user.role == 'OWNER':
            return Activity.objects.all()
        return Activity.objects.none()

class TenantActivityListView(generics.ListAPIView):
    """
    List activities for Local Moderators (limited to their tenant).
    """
    serializer_class = ActivitySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        if self.request.user.role == 'LOCAL_MODERATOR' and self.request.user.tenant_id:
            return Activity.objects.filter(user__tenant_id=self.request.user.tenant_id)
        return Activity.objects.none()
