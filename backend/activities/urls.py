from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ActivityViewSet,
    PrivacyZoneViewSet,
    VoucherRedeemView,
    TelemetryLiveView,
    TelemetryLiveStreamView,
    TelemetryLiveReplayView,
    TelemetryLiveReplayCompareView,
    TelemetryLiveAggregateView,
    TelemetryLiveAuditView,
    LiveMapWebhookListCreateView,
    LiveMapWebhookDetailView,
    LiveMapWebhookTestView,
    AnomalyListView,
    POIViewSet,
    TelemetryConfigView,
    StravaAuthView,
    StravaCallbackView,
    GarminAuthView,
    GarminCallbackView,
    WearableSyncView,
    ActivityDetailView,
    ActivityGpxExportView,
    AIInsightsView,
)

from .admin_views import (
    GlobalActivityListView,
    TenantActivityListView,
    AdminDashboardStatsView,
    DepartmentAnalyticsView,
    ActivityApproveView,
    ActivityRejectView,
    ExportDataView,
    RunSimulationView,
    LiveSimulationView,
    WipeDataView,
    WorkerStatusView,
    ScalePreflightView,
    SimulatorResetView,
    DiskAuditListView,
)
from .payments_views import CreateCheckoutSessionView, StripeWebhookView
from .leaderboard_views import (
    city_leaderboard,
    my_rank,
    department_leaderboard,
    leaderboard_list,
    admin_recalculate_leaderboards,
    admin_leaderboard_list,
    admin_clear_leaderboard,
)
from .heatmap import heatmap_view, analytics_summary_view
from .beta_feedback import BetaFeedbackCreateView, BetaFeedbackListView, BetaFeedbackResolveView

router = DefaultRouter()
router.register(r"sessions", ActivityViewSet, basename="activity")
router.register(r"privacy-zones", PrivacyZoneViewSet, basename="privacy-zone")
router.register(r"pois", POIViewSet, basename="poi")


urlpatterns = [
    path("sessions/<int:pk>/detail/", ActivityDetailView.as_view(), name="activity-detail"),
    path("sessions/<int:pk>/gpx/", ActivityGpxExportView.as_view(), name="activity-gpx"),
    path("", include(router.urls)),
    path("admin/all/", GlobalActivityListView.as_view(), name="global-activities"),
    path("admin/tenant/", TenantActivityListView.as_view(), name="tenant-activities"),
    path("admin/stats/", AdminDashboardStatsView.as_view(), name="admin-stats"),
    path("admin/approve/<int:activity_id>/", ActivityApproveView.as_view(), name="admin-approve"),
    path("admin/reject/<int:activity_id>/", ActivityRejectView.as_view(), name="admin-reject"),
    path("vouchers/redeem/<str:code>/", VoucherRedeemView.as_view(), name="voucher-redeem"),
    path("telemetry/live/", TelemetryLiveView.as_view(), name="telemetry-live"),
    path("telemetry/live/stream/", TelemetryLiveStreamView.as_view(), name="telemetry-live-stream"),
    path("telemetry/live/replay/", TelemetryLiveReplayView.as_view(), name="telemetry-live-replay"),
    path(
        "telemetry/live/replay/compare/",
        TelemetryLiveReplayCompareView.as_view(),
        name="telemetry-live-replay-compare",
    ),
    path("telemetry/live/aggregate/", TelemetryLiveAggregateView.as_view(), name="telemetry-live-aggregate"),
    path("telemetry/live/audit/", TelemetryLiveAuditView.as_view(), name="telemetry-live-audit"),
    path("telemetry/live/webhooks/", LiveMapWebhookListCreateView.as_view(), name="live-map-webhooks"),
    path("telemetry/live/webhooks/<int:pk>/", LiveMapWebhookDetailView.as_view(), name="live-map-webhook-detail"),
    path(
        "telemetry/live/webhooks/<int:pk>/test/",
        LiveMapWebhookTestView.as_view(),
        name="live-map-webhook-test",
    ),
    path("telemetry/anomalies/", AnomalyListView.as_view(), name="telemetry-anomalies"),
    path("telemetry/config/", TelemetryConfigView.as_view(), name="telemetry-config"),
    # Wearables (Milestone 4)
    path("wearables/strava/auth/", StravaAuthView.as_view(), name="strava-auth"),
    path("wearables/strava/callback/", StravaCallbackView.as_view(), name="strava-callback"),
    path("wearables/garmin/auth/", GarminAuthView.as_view(), name="garmin-auth"),
    path("wearables/garmin/callback/", GarminCallbackView.as_view(), name="garmin-callback"),
    path("wearables/sync/", WearableSyncView.as_view(), name="wearable-sync"),
    # Phase 9: Payments
    path("payments/checkout/", CreateCheckoutSessionView.as_view(), name="checkout"),
    path("payments/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
    # Milestone 2: Leaderboard API (Redis-first, <5ms response)
    path("leaderboard/", leaderboard_list, name="leaderboard-list"),
    path(
        "leaderboard/department/<int:department_id>/",
        department_leaderboard,
        name="department-leaderboard",
    ),
    path("leaderboard/<str:city_id>/", city_leaderboard, name="city-leaderboard"),
    path("leaderboard/<str:city_id>/me/", my_rank, name="my-rank"),
    # Admin Leaderboard Management
    path(
        "leaderboard/admin/recalculate/",
        admin_recalculate_leaderboards,
        name="admin-leaderboard-recalculate",
    ),
    path("leaderboard/admin/list/", admin_leaderboard_list, name="admin-leaderboard-list"),
    path(
        "leaderboard/admin/<str:city_id>/", admin_clear_leaderboard, name="admin-leaderboard-clear"
    ),
    # Milestone 5: Premium Analytics
    path("heatmap/", heatmap_view, name="heatmap"),
    path("analytics/department/", DepartmentAnalyticsView.as_view(), name="department-analytics"),
    path("analytics/", analytics_summary_view, name="analytics-summary"),
    # Beta Feedback (RC v0.2)
    path("beta-feedback/", BetaFeedbackCreateView.as_view(), name="beta-feedback-create"),
    path("beta-feedback/list/", BetaFeedbackListView.as_view(), name="beta-feedback-list"),
    path(
        "beta-feedback/<int:feedback_id>/resolve/",
        BetaFeedbackResolveView.as_view(),
        name="beta-feedback-resolve",
    ),
    # AI Insights — auto-generated from analytics
    path("ai/insights/", AIInsightsView.as_view(), name="ai-insights"),
    # Export Endpoints
    path("export/<str:resource>/", ExportDataView.as_view(), name="export-data"),
    # Simulation Endpoint — Aktywne Miasta
    path("admin/scale-preflight/", ScalePreflightView.as_view(), name="admin-scale-preflight"),
    path("admin/disk-audit/", DiskAuditListView.as_view(), name="admin-disk-audit"),
    path("admin/simulate/", RunSimulationView.as_view(), name="admin-simulate"),
    # Live Simulation — Real-time ride simulator
    path("admin/live-simulate/", LiveSimulationView.as_view(), name="admin-live-simulate"),
    path("admin/simulator-reset/", SimulatorResetView.as_view(), name="admin-simulator-reset"),
    # Data Wipe — delete all except GLOBAL_OWNER
    path("admin/wipe-data/", WipeDataView.as_view(), name="admin-wipe-data"),
    # Worker Status — Celery worker monitoring
    path("admin/worker-status/", WorkerStatusView.as_view(), name="admin-worker-status"),
]
