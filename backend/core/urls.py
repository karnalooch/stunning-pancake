from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView
from core.ogc_views import ogc_conformance, ogc_collections, ogc_collection_items, ogc_single_item

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/activities/', include('activities.urls')),
    path('api/clubs/', include('clubs.urls')),
    path('api/', include('events.urls')),       # Events Engine + OGC endpoints
    path('api/rewards/', include('rewards.urls')),  # Milestone 4: Rewards & Stripe
    # OGC API — Moving Features (Milestone 4: Smart City export)
    path('api/ogc/conformance/',                                    ogc_conformance,        name='ogc-conformance'),
    path('api/ogc/collections/',                                    ogc_collections,        name='ogc-collections'),
    path('api/ogc/collections/<str:collection_id>/items/',          ogc_collection_items,   name='ogc-items'),
    path('api/ogc/collections/<str:collection_id>/items/<str:feature_id>/', ogc_single_item, name='ogc-item'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Phase 2: JWT Auth
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    # Social Auth (allauth)
    path('api/auth/social/', include('allauth.socialaccount.urls')),
]


