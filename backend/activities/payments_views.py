import logging

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .payments import PaymentService

logger = logging.getLogger(__name__)

PRICE_IDS = {
    'premium_monthly': 'price_1SPORT_MONTHLY',
    'premium_annual': 'price_1SPORT_ANNUAL',
}


class CreateCheckoutSessionView(APIView):
    """
    POST /api/activities/payments/checkout/

    Creates a Stripe Checkout session for a premium subscription.

    Request body: {"plan": "premium_monthly" | "premium_annual"}
    Response: {"checkout_url": "https://checkout.stripe.com/..."}
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        plan = request.data.get('plan', 'premium_monthly')
        price_id = PRICE_IDS.get(plan)
        if not price_id:
            return Response(
                {'error': f'Unknown plan: {plan}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        url = PaymentService.create_checkout_session(request.user, price_id)
        if url.startswith('http'):
            return Response({'checkout_url': url})
        return Response({'error': url}, status=status.HTTP_502_BAD_GATEWAY)


@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    """
    POST /api/activities/payments/webhook/

    Receives and processes Stripe webhook events.
    Must be exempt from CSRF (Stripe signs requests with its own signature).
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')
        success = PaymentService.handle_webhook(payload, sig_header)
        if success:
            return Response({'status': 'ok'})
        return Response({'error': 'webhook processing failed'}, status=400)
