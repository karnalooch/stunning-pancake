from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ActivityViewSet, PrivacyZoneViewSet, VoucherRedeemView, 
    TelemetryLiveView, AnomalyListView, POIViewSet, TelemetryConfigView,
    StravaAuthView, StravaCallbackView, GarminAuthView, GarminCallbackView,
    WearableSyncView
)

from .admin_views import GlobalActivityListView, TenantActivityListView, AdminDashboardStatsView, ActivityApproveView, ActivityRejectView
from .payments_views import CreateCheckoutSessionView, StripeWebhookView
from .leaderboard_views import city_leaderboard, my_rank
from .heatmap import heatmap_view, analytics_summary_view
from .beta_feedback import BetaFeedbackCreateView, BetaFeedbackListView, BetaFeedbackResolveView

router = DefaultRouter()
router.register(r'sessions', ActivityViewSet, basename='activity')
router.register(r'privacy-zones', PrivacyZoneViewSet, basename='privacy-zone')
router.register(r'pois', POIViewSet, basename='poi')


urlpatterns = [
    path('', include(router.urls)),
    path('admin/all/', GlobalActivityListView.as_view(), name='global-activities'),
    path('admin/tenant/', TenantActivityListView.as_view(), name='tenant-activities'),
    path('admin/stats/', AdminDashboardStatsView.as_view(), name='admin-stats'),
    path('admin/approve/<int:activity_id>/', ActivityApproveView.as_view(), name='admin-approve'),
    path('admin/reject/<int:activity_id>/', ActivityRejectView.as_view(), name='admin-reject'),
    path('vouchers/redeem/<str:code>/', VoucherRedeemView.as_view(), name='voucher-redeem'),
    path('telemetry/live/', TelemetryLiveView.as_view(), name='telemetry-live'),
    path('telemetry/anomalies/', AnomalyListView.as_view(), name='telemetry-anomalies'),
    path('telemetry/config/', TelemetryConfigView.as_view(), name='telemetry-config'),
    # Wearables (Milestone 4)
    path('wearables/strava/auth/', StravaAuthView.as_view(), name='strava-auth'),
    path('wearables/strava/callback/', StravaCallbackView.as_view(), name='strava-callback'),
    path('wearables/garmin/auth/', GarminAuthView.as_view(), name='garmin-auth'),
    path('wearables/garmin/callback/', GarminCallbackView.as_view(), name='garmin-callback'),
    path('wearables/sync/', WearableSyncView.as_view(), name='wearable-sync'),
    # Phase 9: Payments
    path('payments/checkout/', CreateCheckoutSessionView.as_view(), name='checkout'),
    path('payments/webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
    # Milestone 2: Leaderboard API (Redis-first, <5ms response)
    path('leaderboard/<str:city_id>/', city_leaderboard, name='city-leaderboard'),
    path('leaderboard/<str:city_id>/me/', my_rank, name='my-rank'),
    # Milestone 5: Premium Analytics
    path('heatmap/', heatmap_view, name='heatmap'),
    path('analytics/', analytics_summary_view, name='analytics-summary'),
    # Beta Feedback (RC v0.2)
    path('beta-feedback/', BetaFeedbackCreateView.as_view(), name='beta-feedback-create'),
    path('beta-feedback/list/', BetaFeedbackListView.as_view(), name='beta-feedback-list'),
    path('beta-feedback/<int:feedback_id>/resolve/', BetaFeedbackResolveView.as_view(), name='beta-feedback-resolve'),
]
