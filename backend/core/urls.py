from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView
from core.ogc_views import ogc_conformance, ogc_collections, ogc_collection_items, ogc_single_item
from core.infra_views import redis_health_view, citus_health_view, infra_health_view
from core.matrix_e2ee_verify import (
    initiate_verification, accept_verification,
    confirm_verification, verification_status,
)
from core.llm_proxy import llm_proxy

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/users/rbac/', include('users.rbac_urls')),
    path('api/users/departments/', include('users.department_urls')),
    path('api/activities/', include('activities.urls')),
    path('api/clubs/', include('clubs.urls')),
    path('api/', include('events.urls')),       # Events Engine + OGC endpoints
    path('api/rewards/', include('rewards.urls')),  # Milestone 4: Rewards & Stripe
    # OGC API — Moving Features (Milestone 4: Smart City export)
    path('api/ogc/conformance/',                                    ogc_conformance,        name='ogc-conformance'),
    path('api/ogc/collections/',                                    ogc_collections,        name='ogc-collections'),
    path('api/ogc/collections/<str:collection_id>/items/',          ogc_collection_items,   name='ogc-items'),
    path('api/ogc/collections/<str:collection_id>/items/<str:feature_id>/', ogc_single_item, name='ogc-item'),
    # Infrastructure Health (Hyperscale — admin only)
    path('api/infra/health/',         infra_health_view,   name='infra-health'),
    path('api/infra/health/redis/',   redis_health_view,   name='infra-redis'),
    path('api/infra/health/citus/',   citus_health_view,   name='infra-citus'),
    # Matrix E2EE SAS Key Verification
    path('api/matrix/verify/initiate/', initiate_verification, name='matrix-verify-initiate'),
    path('api/matrix/verify/accept/',   accept_verification,   name='matrix-verify-accept'),
    path('api/matrix/verify/confirm/',  confirm_verification,  name='matrix-verify-confirm'),
    path('api/matrix/verify/status/',   verification_status,  name='matrix-verify-status'),
    # LLM Proxy — hides API key from mobile client (v0.1.0-beta.1)
    path('api/llm/proxy/', llm_proxy, name='llm-proxy'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Phase 2: JWT Auth
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    # Social Auth (allauth)
    path('api/auth/social/', include('allauth.socialaccount.urls')),
]


