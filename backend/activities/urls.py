from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ActivityViewSet, PrivacyZoneViewSet, VoucherRedeemView, TelemetryLiveView
from .admin_views import GlobalActivityListView, TenantActivityListView
from .payments_views import CreateCheckoutSessionView, StripeWebhookView

router = DefaultRouter()
router.register(r'sessions', ActivityViewSet, basename='activity')
router.register(r'privacy-zones', PrivacyZoneViewSet, basename='privacy-zone')

urlpatterns = [
    path('', include(router.urls)),
    path('admin/all/', GlobalActivityListView.as_view(), name='global-activities'),
    path('admin/tenant/', TenantActivityListView.as_view(), name='tenant-activities'),
    path('vouchers/redeem/<str:code>/', VoucherRedeemView.as_view(), name='voucher-redeem'),
    path('telemetry/live/', TelemetryLiveView.as_view(), name='telemetry-live'),
    # Phase 9: Payments
    path('payments/checkout/', CreateCheckoutSessionView.as_view(), name='checkout'),
    path('payments/webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
]


