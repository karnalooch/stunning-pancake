import stripe
import os
from django.conf import settings
from users.models import User

stripe.api_key = os.getenv('STRIPE_SECRET_KEY', 'sk_test_placeholder')

class PaymentService:
    """
    Service for handling payments and subscriptions via Stripe.
    """
    @classmethod
    def create_checkout_session(cls, user, price_id):
        """
        Creates a Stripe Checkout session for a subscription.
        """
        try:
            session = stripe.checkout.Session.create(
                customer_email=user.email,
                payment_method_types=['card'],
                line_items=[{
                    'price': price_id,
                    'quantity': 1,
                }],
                mode='subscription',
                success_url=settings.FRONTEND_URL + '/success?session_id={CHECKOUT_SESSION_ID}',
                cancel_url=settings.FRONTEND_URL + '/cancel',
                metadata={'user_id': user.id}
            )
            return session.url
        except Exception as e:
            return str(e)

    @classmethod
    def handle_webhook(cls, payload, sig_header):
        """
        Handles Stripe webhooks (e.g., subscription created, payment failed).
        """
        endpoint_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        except Exception as e:
            return False

        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            user_id = session['metadata']['user_id']
            # Update user subscription status in DB
            User.objects.filter(id=user_id).update(is_premium=True)
            
        return True
