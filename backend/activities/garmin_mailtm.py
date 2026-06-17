"""
Mail.tm integration — temporary email account creation for Garmin registration.

Uses the free Mail.tm API (https://api.mail.tm).
Activated by setting MAILTM_BASE_URL and optionally MAILTM_DOMAIN.

Mail.tm flow:
1. GET /domains → pick first available domain
2. POST /accounts → create email + password
3. POST /token → get Bearer token (stored for later email verification)
4. GET /messages → read incoming emails (for Garmin verification links)

Account credentials are returned as {email, password, token, id}.
"""

from __future__ import annotations

import logging
import os
import random
import string
import time

import requests

logger = logging.getLogger(__name__)

MAILTM_BASE_URL = os.getenv("MAILTM_BASE_URL", "https://api.mail.tm").rstrip("/")
MAILTM_TIMEOUT = int(os.getenv("MAILTM_TIMEOUT", "15"))
MAILTM_DOMAIN_OVERRIDE = os.getenv("MAILTM_DOMAIN", "").strip() or None


class MailTmAccount:
    __slots__ = ("email", "password", "token", "account_id")

    def __init__(self, email: str, password: str, token: str, account_id: str):
        self.email = email
        self.password = password
        self.token = token
        self.account_id = account_id

    def to_dict(self) -> dict:
        return {
            "email": self.email,
            "password": self.password,
            "token": self.token,
            "id": self.account_id,
        }


def _fetch_domain() -> str | None:
    if MAILTM_DOMAIN_OVERRIDE:
        return MAILTM_DOMAIN_OVERRIDE
    try:
        resp = requests.get(f"{MAILTM_BASE_URL}/domains", timeout=MAILTM_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            domains = data if isinstance(data, list) else data.get("hydra:member", [])
            if isinstance(domains, list) and domains:
                first = domains[0]
                if isinstance(first, dict) and first.get("domain"):
                    return str(first["domain"])
                if isinstance(first, str):
                    return first
        logger.warning("Mail.tm /domains failed: HTTP %s", resp.status_code)
    except Exception as exc:
        logger.warning("Mail.tm /domains error: %s", exc)
    return None


def create_account(email_prefix: str | None = None) -> MailTmAccount | None:
    domain = _fetch_domain()
    if not domain:
        logger.error("Mail.tm: no domain available — set MAILTM_DOMAIN or check connectivity")
        return None

    local_part = email_prefix or _random_local_part()
    address = f"{local_part}@{domain}"
    password = _random_password()

    for attempt in range(3):
        try:
            resp = requests.post(
                f"{MAILTM_BASE_URL}/accounts",
                json={"address": address, "password": password},
                timeout=MAILTM_TIMEOUT,
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                account_id = str(data.get("id", ""))
                token = _get_token(address, password)
                if token:
                    logger.info("Mail.tm account created: %s (id=%s)", address, account_id)
                    return MailTmAccount(
                        email=address,
                        password=password,
                        token=token,
                        account_id=account_id,
                    )
                return MailTmAccount(
                    email=address, password=password, token="", account_id=account_id
                )

            if resp.status_code == 422:
                local_part = f"{email_prefix or 'sim'}_{_random_short()}"
                address = f"{local_part}@{domain}"
                time.sleep(0.5)
                continue

            logger.warning("Mail.tm account creation HTTP %s: %s", resp.status_code, resp.text[:200])
            time.sleep(1)
        except Exception as exc:
            logger.warning("Mail.tm account creation error: %s", exc)
            time.sleep(1)

    return None


def _get_token(address: str, password: str) -> str:
    try:
        resp = requests.post(
            f"{MAILTM_BASE_URL}/token",
            json={"address": address, "password": password},
            timeout=MAILTM_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            return str(data.get("token", ""))
        logger.warning("Mail.tm /token failed: HTTP %s", resp.status_code)
    except Exception as exc:
        logger.warning("Mail.tm /token error: %s", exc)
    return ""


def read_messages(token: str) -> list[dict]:
    if not token:
        return []
    try:
        resp = requests.get(
            f"{MAILTM_BASE_URL}/messages",
            headers={"Authorization": f"Bearer {token}"},
            timeout=MAILTM_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                return data
            if isinstance(data, dict) and "hydra:member" in data:
                return data["hydra:member"]
    except Exception as exc:
        logger.warning("Mail.tm /messages error: %s", exc)
    return []


def _random_local_part() -> str:
    return "garmin_" + _random_short()


def _random_short() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=10))


def _random_password() -> str:
    return "".join(random.choices(string.ascii_letters + string.digits + "!@#$", k=16))
