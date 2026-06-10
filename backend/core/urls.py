from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from users.jwt_views import MfaTokenObtainPairView

from core import facebook_auth, google_auth
from core.infra_views import (
    SystemHealthView,
    citus_health_view,
    redis_health_view,
)
from core.llm_proxy import llm_proxy
from core.matrix_e2ee_verify import (
    accept_verification,
    confirm_verification,
    initiate_verification,
    verification_status,
)
from core.ogc_views import ogc_collection_items, ogc_collections, ogc_conformance, ogc_single_item

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("users.urls")),
    path("api/users/rbac/", include("users.rbac_urls")),
    path("api/users/departments/", include("users.department_urls")),
    path("api/activities/", include("activities.urls")),
    path("api/clubs/", include("clubs.urls")),
    path("api/", include("events.urls")),  # Events Engine + OGC endpoints
    path("api/rewards/", include("rewards.urls")),  # Milestone 4: Rewards & Stripe
    # OGC API — Moving Features (Milestone 4: Smart City export)
    path("api/ogc/conformance/", ogc_conformance, name="ogc-conformance"),
    path("api/ogc/collections/", ogc_collections, name="ogc-collections"),
    path("api/ogc/collections/<str:collection_id>/items/", ogc_collection_items, name="ogc-items"),
    path(
        "api/ogc/collections/<str:collection_id>/items/<str:feature_id>/",
        ogc_single_item,
        name="ogc-item",
    ),
    # Infrastructure Health (Hyperscale — admin only)
    path("api/infra/health/", SystemHealthView.as_view(), name="system-health"),
    path("api/infra/health/redis/", redis_health_view, name="infra-redis"),
    path("api/infra/health/citus/", citus_health_view, name="infra-citus"),
    # Matrix E2EE SAS Key Verification
    path("api/matrix/verify/initiate/", initiate_verification, name="matrix-verify-initiate"),
    path("api/matrix/verify/accept/", accept_verification, name="matrix-verify-accept"),
    path("api/matrix/verify/confirm/", confirm_verification, name="matrix-verify-confirm"),
    path("api/matrix/verify/status/", verification_status, name="matrix-verify-status"),
    # LLM Proxy — hides API key from mobile client (v0.1.0-beta.1)
    path("api/llm/proxy/", llm_proxy, name="llm-proxy"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # Phase 2: JWT Auth
    path("api/auth/token/", MfaTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    # Google OAuth2 — custom (bypasses allauth)
    path("api/auth/google/login/", google_auth.google_login, name="google-login"),
    path("api/auth/google/callback/", google_auth.google_callback, name="google-callback"),
    # Facebook OAuth2 — custom (bypasses allauth)
    path("api/auth/facebook/login/", facebook_auth.facebook_login, name="facebook-login"),
    path("api/auth/facebook/callback/", facebook_auth.facebook_callback, name="facebook-callback"),
    # Feature Flags (Hyperscale — admin CRUD)
    path("api/settings/flags/", include("core.feature_urls")),
    path("health/", lambda r: HttpResponse("OK"), name="health"),
]
