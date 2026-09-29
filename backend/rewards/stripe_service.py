"""Fail-closed Stripe boundary for rewards and B2B billing."""

from __future__ import annotations

import logging
import os

import stripe

logger = logging.getLogger(__name__)


def _env(name: str) -> str:
    return os.getenv(name, "").strip()


def _truthy(name: str) -> bool:
    return _env(name).lower() in {"1", "true", "yes", "on"}


def _configure_api_key() -> bool:
    key = _env("STRIPE_SECRET_KEY")
    stripe.api_key = key or None
    return bool(key)


def _frontend_base_url() -> str | None:
    value = _env("FRONTEND_URL").rstrip("/")
    if value.startswith(("https://", "http://")):
        return value
    return None


class StripeService:
    """Stripe operations with explicit configuration and no mock-success paths."""

    @classmethod
    def b2c_available(cls) -> bool:
        return (
            _configure_api_key()
            and bool(_env("STRIPE_B2C_PRICE_ID"))
            and _frontend_base_url() is not None
        )

    @classmethod
    def b2b_available(cls) -> bool:
        return (
            _truthy("STRIPE_B2B_BILLING_ENABLED")
            and _configure_api_key()
            and bool(_env("STRIPE_B2B_PRICE_ID"))
            and _frontend_base_url() is not None
        )

    @classmethod
    def webhook_available(cls) -> bool:
        return bool(_env("STRIPE_WEBHOOK_SECRET"))

    @classmethod
    def create_b2c_checkout(cls, user_id: int, email: str) -> str | None:
        if not cls.b2c_available():
            logger.warning("stripe.b2c_unavailable")
            return None

        base = _frontend_base_url()
        price_id = _env("STRIPE_B2C_PRICE_ID")
        assert base is not None
        try:
            session = stripe.checkout.Session.create(
                customer_email=email,
                payment_method_types=["card"],
                line_items=[{"price": price_id, "quantity": 1}],
                mode="subscription",
                success_url=base + "/success?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=base + "/cancel",
                metadata={"user_id": str(user_id), "plan": "B2C_PREMIUM"},
            )
            logger.info("stripe.checkout_created user=%d session=%s", user_id, session.id)
            return session.url
        except stripe.StripeError as exc:
            logger.error("stripe.checkout_error user=%d err=%s", user_id, exc)
            return None

    @classmethod
    def create_b2b_checkout(cls, tenant_id: str, email: str, seats: int) -> str | None:
        if not cls.b2b_available():
            logger.warning("stripe.b2b_unavailable")
            return None

        base = _frontend_base_url()
        price_id = _env("STRIPE_B2B_PRICE_ID")
        assert base is not None
        try:
            session = stripe.checkout.Session.create(
                customer_email=email,
                payment_method_types=["card"],
                line_items=[{"price": price_id, "quantity": seats}],
                mode="subscription",
                success_url=base + "/success?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=base + "/cancel",
                metadata={"tenant_id": tenant_id, "plan": "B2B_CORPORATE", "seats": str(seats)},
            )
            logger.info("stripe.b2b_checkout_created tenant=%s seats=%d", tenant_id, seats)
            return session.url
        except stripe.StripeError:
            logger.exception("stripe.b2b_checkout_error tenant=%s", tenant_id)
            return None

    @classmethod
    def create_customer_portal(cls, stripe_customer_id: str) -> str | None:
        if not _configure_api_key():
            logger.warning("stripe.portal_unavailable")
            return None
        base = _frontend_base_url()
        if base is None:
            logger.warning("stripe.portal_frontend_unavailable")
            return None

        try:
            session = stripe.billing_portal.Session.create(
                customer=stripe_customer_id,
                return_url=base,
            )
            return session.url
        except stripe.StripeError as exc:
            logger.error("stripe.portal_error customer=%s err=%s", stripe_customer_id, exc)
            return None

    @classmethod
    def create_connect_account(
        cls, user_id: int, email: str, refresh_url: str, return_url: str
    ) -> dict | None:
        """Create a Stripe Express account. Never synthesize a success when disabled."""
        if not _configure_api_key():
            logger.warning("stripe.connect_unavailable")
            return None

        try:
            account = stripe.Account.create(
                type="express",
                email=email,
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
                metadata={"user_id": str(user_id)},
            )
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
    def create_transfer(
        cls, amount_cents: int, destination_acct: str, description: str = "Reward payout"
    ) -> str | None:
        """Create a payout transfer. Never return a fake transfer identifier."""
        if not _configure_api_key():
            logger.warning("stripe.transfer_unavailable")
            return None

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
        secret = _env("STRIPE_WEBHOOK_SECRET")
        if not secret:
            logger.error("stripe.webhook_unavailable")
            return {"status": "unavailable"}

        try:
            event = stripe.Webhook.construct_event(payload, sig_header, secret)
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
            cls._deactivate_subscription(data.get("customer"))

        return {"status": "ok", "event_type": etype}

    @classmethod
    def _activate_user_subscription(cls, user_id: int, subscription_id: str | None) -> None:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        User.objects.filter(pk=user_id).update(is_premium=True)
        logger.info("stripe.user_activated user=%d sub=%s", user_id, subscription_id)

    @classmethod
    def _activate_tenant_subscription(cls, tenant_id: str, subscription_id: str | None) -> None:
        # Billing remains disabled by default until tenant subscription persistence is implemented.
        logger.info("stripe.tenant_activated tenant=%s sub=%s", tenant_id, subscription_id)

    @classmethod
    def _deactivate_subscription(cls, customer_id: str | None) -> None:
        logger.info("stripe.subscription_cancelled customer=%s", customer_id)
