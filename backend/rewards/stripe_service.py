"""
Stripe Subscription Service (Milestone 4)
==========================================
Constitution §18: Financial and Social Ecosystem

Handles:
- B2C Freemium → Premium subscription checkout.
- B2B Corporate plan management via Stripe Customer Portal.
- Webhook processing for subscription lifecycle events.

Env vars required:
    STRIPE_SECRET_KEY    — sk_live_... or sk_test_...
    STRIPE_WEBHOOK_SECRET — whsec_... (from Stripe Dashboard)
    STRIPE_B2C_PRICE_ID  — Price ID for individual Premium plan
    STRIPE_B2B_PRICE_ID  — Price ID for corporate seat plan
"""
from __future__ import annotations

import logging
import os

import stripe

logger = logging.getLogger(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
B2C_PRICE_ID = os.getenv("STRIPE_B2C_PRICE_ID", "")
B2B_PRICE_ID = os.getenv("STRIPE_B2B_PRICE_ID", "")

_IS_CONFIGURED = bool(stripe.api_key and not stripe.api_key.startswith("sk_test_placeholder"))


class StripeService:
    """
    Wrapper for Stripe API operations.

    All methods degrade gracefully when STRIPE_SECRET_KEY is not configured
    (returns None/False), ensuring tests and local dev are unaffected.
    """

    @classmethod
    def create_b2c_checkout(cls, user_id: int, email: str, success_url: str, cancel_url: str) -> str | None:
        """
        Creates a Stripe Checkout Session for B2C Premium subscription.

        Args:
            user_id: Django User PK (stored as metadata for webhook processing).
            email: User's email address.
            success_url: Redirect URL on payment success.
            cancel_url: Redirect URL on payment cancel.

        Returns:
            Checkout Session URL, or None if Stripe is not configured.
        """
        if not _IS_CONFIGURED:
            logger.debug("stripe: not configured — returning mock checkout URL")
            return f"{success_url}?mock=1"

        try:
            session = stripe.checkout.Session.create(
                customer_email=email,
                payment_method_types=["card"],
                line_items=[{"price": B2C_PRICE_ID, "quantity": 1}],
                mode="subscription",
                success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=cancel_url,
                metadata={"user_id": str(user_id), "plan": "B2C_PREMIUM"},
            )
            logger.info("stripe.checkout_created user=%d session=%s", user_id, session.id)
            return session.url
        except stripe.StripeError as exc:
            logger.error("stripe.checkout_error user=%d err=%s", user_id, exc)
            return None

    @classmethod
    def create_b2b_checkout(cls, tenant_id: str, email: str, seats: int, success_url: str, cancel_url: str) -> str | None:
        """
        Creates a Stripe Checkout Session for B2B corporate subscription.

        Args:
            tenant_id: The corporate tenant identifier.
            email: Billing contact email.
            seats: Number of seats to purchase.
            success_url: Redirect on success.
            cancel_url: Redirect on cancel.

        Returns:
            Checkout Session URL, or None on failure.
        """
        if not _IS_CONFIGURED:
            return f"{success_url}?mock=1"

        try:
            session = stripe.checkout.Session.create(
                customer_email=email,
                payment_method_types=["card"],
                line_items=[{"price": B2B_PRICE_ID, "quantity": seats}],
                mode="subscription",
                success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=cancel_url,
                metadata={"tenant_id": tenant_id, "plan": "B2B_CORPORATE", "seats": str(seats)},
            )
            logger.info("stripe.b2b_checkout_created tenant=%s seats=%d", tenant_id, seats)
            return session.url
        except stripe.StripeError as exc:
            logger.error("stripe.b2b_checkout_error tenant=%s err=%s", tenant_id, exc)
            return None

    @classmethod
    def create_customer_portal(cls, stripe_customer_id: str, return_url: str) -> str | None:
        """
        Creates a Stripe Customer Portal session for self-service billing management.

        Args:
            stripe_customer_id: Stripe Customer ID (cus_xxx).
            return_url: URL to redirect to after portal session.

        Returns:
            Portal Session URL, or None on failure.
        """
        if not _IS_CONFIGURED:
            return return_url

        try:
            session = stripe.billing_portal.Session.create(
                customer=stripe_customer_id,
                return_url=return_url,
            )
            return session.url
        except stripe.StripeError as exc:
            logger.error("stripe.portal_error customer=%s err=%s", stripe_customer_id, exc)
            return None

    # --- STRIPE CONNECT (Milestone 4: Multi-Sponsor Payouts) ---

    @classmethod
    def create_connect_account(cls, user_id: int, email: str, refresh_url: str, return_url: str) -> dict | None:
        """
        Creates a Stripe Express account and an onboarding link for an athlete.
        """
        if not _IS_CONFIGURED:
            return {"url": f"{return_url}?mock=1", "account_id": "acct_mock"}

        try:
            # 1. Create the Express account
            account = stripe.Account.create(
                type="express",
                email=email,
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
                metadata={"user_id": str(user_id)}
            )

            # 2. Create an Account Link for onboarding
            account_link = stripe.AccountLink.create(
                account=account.id,
                refresh_url=refresh_url,
                return_url=return_url,
                type="account_onboarding",
            )

            return {"url": account_link.url, "account_id": account.id}
        except stripe.StripeError as exc:
            logger.error("stripe.connect_error user=%d err=%s", user_id, exc)
            return None

    @classmethod
    def create_transfer(cls, amount_cents: int, destination_acct: str, description: str = "Reward payout") -> str | None:
        """
        Transfers funds from the platform to a connected athlete account.
        """
        if not _IS_CONFIGURED:
            logger.info("stripe.transfer_mock amount=%d to=%s", amount_cents, destination_acct)
            return "tr_mock_123"

        try:
            transfer = stripe.Transfer.create(
                amount=amount_cents,
                currency="usd",
                destination=destination_acct,
                description=description,
            )
            return transfer.id
        except stripe.StripeError as exc:
            logger.error("stripe.transfer_error to=%s err=%s", destination_acct, exc)
            return None

    @classmethod
    def handle_webhook(cls, payload: bytes, sig_header: str) -> dict:
        """
        Validates and processes a Stripe webhook event.

        Handles:
        - `checkout.session.completed` → activate subscription.
        - `customer.subscription.deleted` → downgrade to free tier.

        Args:
            payload: Raw request body bytes.
            sig_header: Value of Stripe-Signature HTTP header.

        Returns:
            dict with 'status' and optional 'event_type'.
        """
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)
        except (stripe.SignatureVerificationError, ValueError) as exc:
            logger.error("stripe.webhook_invalid err=%s", exc)
            return {"status": "invalid_signature"}

        etype = event["type"]
        data = event["data"]["object"]
        logger.info("stripe.webhook event=%s", etype)

        if etype == "checkout.session.completed":
            metadata = data.get("metadata", {})
            user_id = metadata.get("user_id")
            tenant_id = metadata.get("tenant_id")
            if user_id:
                cls._activate_user_subscription(int(user_id), data.get("subscription"))
            elif tenant_id:
                cls._activate_tenant_subscription(tenant_id, data.get("subscription"))

        elif etype == "customer.subscription.deleted":
            customer_id = data.get("customer")
            cls._deactivate_subscription(customer_id)

        return {"status": "ok", "event_type": etype}

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    @classmethod
    def _activate_user_subscription(cls, user_id: int, subscription_id: str | None) -> None:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        User.objects.filter(pk=user_id).update(is_premium=True)
        logger.info("stripe.user_activated user=%d sub=%s", user_id, subscription_id)

    @classmethod
    def _activate_tenant_subscription(cls, tenant_id: str, subscription_id: str | None) -> None:
        # Hook for future TenantConfig model
        logger.info("stripe.tenant_activated tenant=%s sub=%s", tenant_id, subscription_id)

    @classmethod
    def _deactivate_subscription(cls, customer_id: str | None) -> None:
        logger.info("stripe.subscription_cancelled customer=%s", customer_id)
        # Hook: set is_premium=False for user with matching stripe_customer_id
