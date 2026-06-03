from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .feature_views import FeatureFlagViewSet

router = DefaultRouter()
router.register("", FeatureFlagViewSet, basename="feature-flag")
urlpatterns = [
    path("", include(router.urls)),
]
