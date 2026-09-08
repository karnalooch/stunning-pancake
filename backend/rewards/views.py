"""
Rewards REST API Views (Milestone 4)
======================================
Endpoints:
    GET  /api/rewards/balance/          → User's current points balance
    GET  /api/rewards/pools/            → Available voucher pools
    POST /api/rewards/redeem/{pool_id}/ → Redeem a voucher
    POST /api/rewards/stripe/b2c/       → Create B2C checkout session
    POST /api/rewards/stripe/b2b/       → Create B2B checkout session
    POST /api/rewards/stripe/portal/    → Create billing portal session
    POST /api/rewards/stripe/webhook/   → Stripe webhook receiver
"""

from __future__ import annotations

import logging

from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from rewards.models import Sponsor, SponsorCampaign, Voucher, VoucherPool
from rewards.services import RewardsService
from rewards.stripe_service import StripeService
from users.permissions import IsGlobalOwner

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------


class VoucherPoolCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    points_required = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=500, default=10)
    valid_days = serializers.IntegerField(min_value=1, max_value=365, default=90)


class VoucherPoolSerializer(serializers.ModelSerializer):
    sponsor_name = serializers.CharField(source="sponsor.name", read_only=True)
    available = serializers.IntegerField(source="available_count", read_only=True)

    class Meta:
        model = VoucherPool
        fields = [
            "id",
            "title",
            "description",
            "points_required",
            "sponsor_name",
            "available",
            "valid_from",
            "valid_until",
        ]


class VoucherSerializer(serializers.ModelSerializer):
    pool_title = serializers.CharField(source="pool.title", read_only=True)
    sponsor_name = serializers.CharField(source="pool.sponsor.name", read_only=True)

    class Meta:
        model = Voucher
        fields = ["id", "code", "pool_title", "sponsor_name", "redeemed_at", "is_used"]


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def balance_view(request: Request) -> Response:
    """Returns the current points balance for the authenticated user."""
    balance = RewardsService.get_balance(request.user.pk)
    return Response({"points": balance})


def _get_or_create_sponsor(user) -> Sponsor:
    try:
        return user.sponsor_profile
    except ObjectDoesNotExist:
        tenant_id = getattr(user, "tenant_id", None)
        return Sponsor.objects.create(
            user=user,
            name=(user.get_full_name() or user.username or "Sponsor").strip(),
            tenant_id=str(tenant_id) if tenant_id else "",
        )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def pool_list_view(request: Request) -> Response:
    """Lists active voucher pools. SPONSOR sees own pools. POST creates a pool (SPONSOR / GLOBAL_OWNER)."""
    if request.method == "POST":
        role = getattr(request.user, "role", None)
        if role not in ("SPONSOR", "GLOBAL_OWNER"):
            return Response(
                {"detail": "Only sponsors can create voucher pools."},
                status=status.HTTP_403_FORBIDDEN,
            )

        ser = VoucherPoolCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        sponsor = _get_or_create_sponsor(request.user)
        pool = RewardsService.create_voucher_pool(sponsor, **ser.validated_data)
        return Response(VoucherPoolSerializer(pool).data, status=status.HTTP_201_CREATED)

    now = timezone.now()
    pools = (
        VoucherPool.objects.filter(
            valid_from__lte=now,
            valid_until__gte=now,
        )
        .select_related("sponsor")
        .order_by("points_required")
    )
    role = getattr(request.user, "role", None)
    if role == "SPONSOR":
        try:
            sponsor = request.user.sponsor_profile
            pools = pools.filter(sponsor=sponsor)
        except ObjectDoesNotExist:
            pools = pools.none()
    return Response(VoucherPoolSerializer(pools, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sponsor_stats_view(request: Request) -> Response:
    """Returns analytics for the authenticated sponsor. Falls back to empty stats for non-sponsor roles."""
    try:
        sponsor = request.user.sponsor_profile
    except ObjectDoesNotExist:
        return Response(
            {
                "poi_count": 0,
                "vouchers_distributed": 0,
                "redeemed_count": 0,
                "redemption_rate": 0,
                "active_vouchers": 0,
                "expired_vouchers": 0,
            }
        )

    try:
        from activities.models import POI

        pools = sponsor.pools.all()
        total_vouchers = Voucher.objects.filter(pool__in=pools).count()
        redeemed_vouchers = Voucher.objects.filter(pool__in=pools, user__isnull=False).count()
        poi_qs = POI.objects.filter(sponsor=sponsor)
        tenant_uuid = getattr(request.user, "tenant_id", None) or sponsor.tenant_id or None
        if tenant_uuid:
            poi_qs = poi_qs.filter(tenant_id=tenant_uuid)

        return Response(
            {
                "poi_count": poi_qs.count(),
                "vouchers_distributed": total_vouchers,
                "redeemed_count": redeemed_vouchers,
                "redemption_rate": (redeemed_vouchers / total_vouchers)
                if total_vouchers > 0
                else 0,
                "active_vouchers": Voucher.objects.filter(
                    pool__in=pools, user__isnull=False, is_used=False
                ).count(),
                "expired_vouchers": Voucher.objects.filter(
                    pool__in=pools, pool__valid_until__lt=timezone.now()
                ).count(),
            }
        )
    except Exception as e:
        return Response(
            {
                "poi_count": 0,
                "vouchers_distributed": 0,
                "redeemed_count": 0,
                "redemption_rate": 0,
                "active_vouchers": 0,
                "expired_vouchers": 0,
                "error": str(e),
            }
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def redeem_view(request: Request, pool_id: int) -> Response:
    """
    Atomically redeems one voucher from the specified pool.
    Deducts points from the user's balance.
    """
    voucher = RewardsService.redeem_voucher(
        user_id=request.user.pk,
        pool_id=pool_id,
    )
    if voucher is None:
        return Response(
            {"error": "Redemption failed. Check your balance or pool availability."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(VoucherSerializer(voucher).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stripe_b2c_checkout_view(request: Request) -> Response:
    """Creates a Stripe Checkout session for the B2C Premium plan."""
    url = StripeService.create_b2c_checkout(
        user_id=request.user.pk,
        email=request.user.email,
        success_url=request.data.get("success_url", ""),
        cancel_url=request.data.get("cancel_url", ""),
    )
    if not url:
        return Response(
            {"error": "Checkout unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    return Response({"checkout_url": url})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stripe_b2b_checkout_view(request: Request) -> Response:
    """Creates a Stripe Checkout session for a B2B corporate plan."""
    tenant_id = request.data.get("tenant_id", "")
    seats = int(request.data.get("seats", 1))
    url = StripeService.create_b2b_checkout(
        tenant_id=tenant_id,
        email=request.user.email,
        seats=seats,
        success_url=request.data.get("success_url", ""),
        cancel_url=request.data.get("cancel_url", ""),
    )
    if not url:
        return Response(
            {"error": "Checkout unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    return Response({"checkout_url": url})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stripe_portal_view(request: Request) -> Response:
    """Creates a Stripe Customer Portal session for self-service billing."""
    stripe_customer_id = getattr(request.user, "stripe_customer_id", None)
    if not stripe_customer_id:
        return Response({"error": "No billing account found."}, status=status.HTTP_404_NOT_FOUND)
    url = StripeService.create_customer_portal(
        stripe_customer_id=stripe_customer_id,
        return_url=request.data.get("return_url", "/"),
    )
    return Response({"portal_url": url})


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_webhook_view(request: Request) -> Response:
    """Stripe webhook receiver — validates signature and processes events."""
    sig = request.META.get("HTTP_STRIPE_SIGNATURE", "")
    result = StripeService.handle_webhook(request.body, sig)
    if result.get("status") == "invalid_signature":
        return Response(result, status=status.HTTP_400_BAD_REQUEST)
    return Response(result)


class SponsorCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = SponsorCampaign
        fields = (
            "id",
            "title",
            "status",
            "start_date",
            "end_date",
            "budget_points",
            "created_at",
            "sponsor",
        )
        read_only_fields = ("id", "created_at", "sponsor")


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def sponsor_campaigns_view(request: Request) -> Response:
    """CRUD list/create campaigns for authenticated sponsor."""
    try:
        sponsor = request.user.sponsor_profile
    except ObjectDoesNotExist:
        return Response({"detail": "Sponsor profile required"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        qs = SponsorCampaign.objects.filter(sponsor=sponsor).order_by("-created_at")
        return Response(SponsorCampaignSerializer(qs, many=True).data)

    ser = SponsorCampaignSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    campaign = ser.save(sponsor=sponsor)
    return Response(SponsorCampaignSerializer(campaign).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def sponsor_campaign_detail_view(request: Request, pk: int) -> Response:
    try:
        sponsor = request.user.sponsor_profile
    except ObjectDoesNotExist:
        return Response({"detail": "Sponsor profile required"}, status=status.HTTP_403_FORBIDDEN)
    try:
        campaign = SponsorCampaign.objects.get(pk=pk, sponsor=sponsor)
    except SponsorCampaign.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(SponsorCampaignSerializer(campaign).data)
    if request.method == "PATCH":
        ser = SponsorCampaignSerializer(campaign, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response(ser.data)
    campaign.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sponsor_stats_timeseries_view(request: Request) -> Response:
    """Daily redemption counts for sponsor pools (7d default)."""
    try:
        sponsor = request.user.sponsor_profile
    except ObjectDoesNotExist:
        return Response({"series": []})

    days = int(request.query_params.get("days", 7))
    pools = sponsor.pools.all()
    from django.db.models import Count
    from django.db.models.functions import TruncDate

    qs = (
        Voucher.objects.filter(pool__in=pools, user__isnull=False)
        .annotate(day=TruncDate("redeemed_at"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )
    return Response(
        {"series": [{"day": str(r["day"]), "count": r["count"]} for r in qs if r["day"]]}
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sponsor_activity_feed_view(request: Request) -> Response:
    """Recent redemptions for sponsor pools."""
    try:
        sponsor = request.user.sponsor_profile
    except ObjectDoesNotExist:
        return Response({"results": []})

    vouchers = (
        Voucher.objects.filter(pool__sponsor=sponsor, user__isnull=False)
        .select_related("pool", "user")
        .order_by("-redeemed_at")[:25]
    )
    return Response(
        {
            "results": [
                {
                    "pool_title": v.pool.title,
                    "code_masked": v.code[:4] + "****" if v.code else "",
                    "redeemed_at": v.redeemed_at.isoformat() if v.redeemed_at else None,
                    "user": v.user.username if v.user_id else None,
                }
                for v in vouchers
            ]
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGlobalOwner])
def platform_revenue_summary_view(request: Request) -> Response:
    """MVP revenue summary for GLOBAL_OWNER control plane."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    premium_count = User.objects.filter(is_premium=True).count()
    sponsor_count = Sponsor.objects.filter(is_active=True).count()
    return Response(
        {
            "premium_users": premium_count,
            "active_sponsors": sponsor_count,
            "mrr_estimate_usd": premium_count * 9.99,
            "stripe_webhook_status": "configured",
        }
    )
