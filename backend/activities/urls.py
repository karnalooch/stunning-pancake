from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ActivityViewSet, PrivacyZoneViewSet, VoucherRedeemView, TelemetryLiveView, AnomalyListView
from .admin_views import GlobalActivityListView, TenantActivityListView, AdminDashboardStatsView
from .payments_views import CreateCheckoutSessionView, StripeWebhookView
from .leaderboard_views import city_leaderboard, my_rank
from .heatmap import heatmap_view, analytics_summary_view

router = DefaultRouter()
router.register(r'sessions', ActivityViewSet, basename='activity')
router.register(r'privacy-zones', PrivacyZoneViewSet, basename='privacy-zone')

urlpatterns = [
    path('', include(router.urls)),
    path('admin/all/', GlobalActivityListView.as_view(), name='global-activities'),
    path('admin/tenant/', TenantActivityListView.as_view(), name='tenant-activities'),
    path('admin/stats/', AdminDashboardStatsView.as_view(), name='admin-stats'),
    path('vouchers/redeem/<str:code>/', VoucherRedeemView.as_view(), name='voucher-redeem'),
    path('telemetry/live/', TelemetryLiveView.as_view(), name='telemetry-live'),
    path('telemetry/anomalies/', AnomalyListView.as_view(), name='telemetry-anomalies'),
    # Phase 9: Payments
    path('payments/checkout/', CreateCheckoutSessionView.as_view(), name='checkout'),
    path('payments/webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
    # Milestone 2: Leaderboard API (Redis-first, <5ms response)
    path('leaderboard/<str:city_id>/', city_leaderboard, name='city-leaderboard'),
    path('leaderboard/<str:city_id>/me/', my_rank, name='my-rank'),
    # Milestone 5: Premium Analytics
    path('heatmap/', heatmap_view, name='heatmap'),
    path('analytics/', analytics_summary_view, name='analytics-summary'),
]
