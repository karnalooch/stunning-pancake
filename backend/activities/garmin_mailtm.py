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
import urllib3

logger = logging.getLogger(__name__)

MAILTM_BASE_URL = os.getenv("MAILTM_BASE_URL", "https://api.mail.tm").rstrip("/")
MAILTM_TIMEOUT = int(os.getenv("MAILTM_TIMEOUT", "10"))
MAILTM_DOMAIN_OVERRIDE = os.getenv("MAILTM_DOMAIN", "").strip() or None

# Disable insecure request warnings when SSL verification is disabled
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

_MAILTM_SESSION: requests.Session | None = None


def _get_session() -> requests.Session:
    global _MAILTM_SESSION
    if _MAILTM_SESSION is None:
        _MAILTM_SESSION = requests.Session()
        _MAILTM_SESSION.headers.update({
            "Accept": "application/json",
            "Content-Type": "application/json",
        })
    return _MAILTM_SESSION


def _mailtm_request(method: str, path: str, **kwargs) -> requests.Response | None:
    """Make a Mail.tm API request with SSL fallback."""
    session = _get_session()
    url = f"{MAILTM_BASE_URL}{path}"
    kwargs.setdefault("timeout", MAILTM_TIMEOUT)

    # Try with SSL verification first
    try:
        return session.request(method, url, verify=True, **kwargs)
    except (requests.exceptions.SSLError, requests.exceptions.ConnectionError,
            OSError, urllib3.exceptions.SSLError) as exc:
        logger.debug("Mail.tm SSL error on first attempt, retrying without verification: %s", exc)
        try:
            return session.request(method, url, verify=False, **kwargs)
        except Exception as exc2:
            logger.warning("Mail.tm request failed (no verify): %s", exc2)
            return None
    except Exception as exc:
        logger.warning("Mail.tm request failed: %s", exc)
        return None


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
        resp = _mailtm_request("GET", "/domains")
        if resp is None:
            return None
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
            resp = _mailtm_request("POST", "/accounts", json={"address": address, "password": password})
            if resp is None:
                global _MAILTM_SESSION
                _MAILTM_SESSION = None
                return None
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

            if resp.status_code == 429:
                logger.warning("Mail.tm rate limited (429), skipping account %s", address)
                return None

            if resp.status_code == 422:
                local_part = f"{email_prefix or 'sim'}_{_random_short()}"
                address = f"{local_part}@{domain}"
                continue

            logger.warning("Mail.tm account creation HTTP %s: %s", resp.status_code, resp.text[:200])
            time.sleep(0.3)
        except Exception as exc:
            logger.warning("Mail.tm account creation error: %s", exc)
            time.sleep(0.3)

    return None


def _get_token(address: str, password: str) -> str:
    try:
        resp = _mailtm_request("POST", "/token", json={"address": address, "password": password})
        if resp is None:
            return ""
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
        resp = _mailtm_request("GET", "/messages", headers={"Authorization": f"Bearer {token}"})
        if resp is None:
            return []
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
