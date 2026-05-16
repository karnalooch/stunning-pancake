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

from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from rewards.models import VoucherPool, Voucher, Sponsor
from rewards.services import RewardsService
from rewards.stripe_service import StripeService

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

class VoucherPoolSerializer(serializers.ModelSerializer):
    sponsor_name = serializers.CharField(source="sponsor.name", read_only=True)
    available = serializers.IntegerField(source="available_count", read_only=True)

    class Meta:
        model = VoucherPool
        fields = ["id", "title", "description", "points_required", "sponsor_name",
                  "available", "valid_from", "valid_until"]


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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pool_list_view(request: Request) -> Response:
    """Lists all currently active voucher pools."""
    now = timezone.now()
    pools = VoucherPool.objects.filter(
        valid_from__lte=now,
        valid_until__gte=now,
    ).select_related("sponsor").order_by("points_required")
    return Response(VoucherPoolSerializer(pools, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sponsor_stats_view(request: Request) -> Response:
    """Returns analytics for the authenticated sponsor. Falls back to empty stats for non-sponsor roles."""
    try:
        sponsor = request.user.sponsor_profile
    except Sponsor.DoesNotExist:
        return Response({
            "poi_count": 0,
            "vouchers_distributed": 0,
            "redeemed_count": 0,
            "redemption_rate": 0,
            "active_vouchers": 0,
            "expired_vouchers": 0,
        })

    try:
        pools = sponsor.pools.all()
        total_vouchers = Voucher.objects.filter(pool__in=pools).count()
        redeemed_vouchers = Voucher.objects.filter(pool__in=pools, user__isnull=False).count()
        
        return Response({
            "poi_count": sponsor.pools.count(),
            "vouchers_distributed": total_vouchers,
            "redeemed_count": redeemed_vouchers,
            "redemption_rate": (redeemed_vouchers / total_vouchers) if total_vouchers > 0 else 0,
            "active_vouchers": Voucher.objects.filter(pool__in=pools, user__isnull=False, is_used=False).count(),
            "expired_vouchers": Voucher.objects.filter(pool__in=pools, pool__valid_until__lt=timezone.now()).count(),
        })
    except Exception as e:
        return Response({
            "poi_count": 0,
            "vouchers_distributed": 0,
            "redeemed_count": 0,
            "redemption_rate": 0,
            "active_vouchers": 0,
            "expired_vouchers": 0,
            "error": str(e),
        })


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
        return Response({"error": "Checkout unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
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
        return Response({"error": "Checkout unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
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
