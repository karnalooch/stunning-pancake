"""Events URL routing."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AchievementViewSet, CityHubSummaryView, EventViewSet

router = DefaultRouter()
router.register(r"events", EventViewSet, basename="event")
router.register(r"achievements", AchievementViewSet, basename="achievement")

urlpatterns = [
    path("events/city-hub/", CityHubSummaryView.as_view(), name="city-hub-summary"),
    path("", include(router.urls)),
]
