"""Rewards app URL configuration."""

from django.urls import path

from rewards import views

app_name = "rewards"

urlpatterns = [
    path("balance/", views.balance_view, name="balance"),
    path("pools/", views.pool_list_view, name="pool-list"),
    path("redeem/<int:pool_id>/", views.redeem_view, name="redeem"),
    path("sponsor-stats/", views.sponsor_stats_view, name="sponsor-stats"),
    path("sponsor-stats/timeseries/", views.sponsor_stats_timeseries_view, name="sponsor-stats-ts"),
    path("sponsor-activity/", views.sponsor_activity_feed_view, name="sponsor-activity"),
    path("campaigns/", views.sponsor_campaigns_view, name="sponsor-campaigns"),
    path("campaigns/<int:pk>/", views.sponsor_campaign_detail_view, name="sponsor-campaign-detail"),
    path("admin/revenue-summary/", views.platform_revenue_summary_view, name="revenue-summary"),
    path("stripe/b2c/", views.stripe_b2c_checkout_view, name="stripe-b2c"),
    path("stripe/b2b/", views.stripe_b2b_checkout_view, name="stripe-b2b"),
    path("stripe/portal/", views.stripe_portal_view, name="stripe-portal"),
    path("stripe/webhook/", views.stripe_webhook_view, name="stripe-webhook"),
]
