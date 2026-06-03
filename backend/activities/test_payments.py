"""
P3 Tests — PaymentService (Stripe Webhook Validation)
======================================================
Tests the P0 Issue 1 fixes: webhook secret enforcement, signature
verification, and checkout.session.completed event handling.
"""

import pytest
from unittest.mock import patch
from activities.payments import PaymentService


class TestPaymentService:
    def test_webhook_rejected_without_secret(self):
        """Webhook must be rejected if STRIPE_WEBHOOK_SECRET is not set."""
        with patch("activities.payments.os.getenv", return_value=None):
            result = PaymentService.handle_webhook(b'{"type":"test"}', "sig_abc")
            assert result is False

    def test_webhook_signature_verification_failure(self):
        """Webhook returns False on signature mismatch."""
        with (
            patch("activities.payments.os.getenv", return_value="whsec_test"),
            patch("activities.payments.stripe.Webhook.construct_event") as mock_construct,
        ):
            import stripe

            mock_construct.side_effect = stripe.error.SignatureVerificationError(
                "Invalid signature", "sig_header"
            )
            result = PaymentService.handle_webhook(b"payload", "sig_abc")
            assert result is False

    def test_webhook_checkout_completed_activates_premium(self):
        """Valid webhook with checkout.session.completed sets is_premium=True."""
        with (
            patch(
                "activities.payments.os.getenv",
                side_effect=lambda k, d=None: "whsec_test" if "WEBHOOK" in str(k) else d,
            ),
            patch("activities.payments.stripe.Webhook.construct_event") as mock_construct,
            patch("activities.payments.User") as mock_user,
        ):
            mock_construct.return_value = {
                "type": "checkout.session.completed",
                "data": {"object": {"metadata": {"user_id": 42}}},
            }
            mock_user.objects.filter.return_value.update.return_value = 1
            result = PaymentService.handle_webhook(b"payload", "sig_abc")
            assert result is True
            mock_user.objects.filter.assert_called_once_with(id=42)
            mock_user.objects.filter.return_value.update.assert_called_once_with(is_premium=True)
