from django.urls import path
from rest_framework.routers import DefaultRouter

from .notice_views import ActivePlatformNoticesView, PlatformNoticeViewSet

router = DefaultRouter()
router.register("notices", PlatformNoticeViewSet, basename="platform-notice")

urlpatterns = [
    path("notices/active/", ActivePlatformNoticesView.as_view(), name="platform-notices-active"),
    *router.urls,
]
