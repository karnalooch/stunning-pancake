"""TOTP MFA helpers (RFC 6238) — no external dependency."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time


def generate_totp_secret() -> str:
    """URL-safe base32 secret for authenticator apps."""
    raw = secrets.token_bytes(20)
    return base64.b32encode(raw).decode("ascii").rstrip("=")


def _totp_at(secret: str, counter: int, digits: int = 6) -> str:
    key = base64.b32decode(secret.upper() + "=" * ((8 - len(secret) % 8) % 8))
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10**digits)).zfill(digits)


def verify_totp(secret: str, code: str, *, window: int = 1) -> bool:
    if not secret or not code or not str(code).isdigit():
        return False
    now = int(time.time()) // 30
    for w in range(-window, window + 1):
        if hmac.compare_digest(_totp_at(secret, now + w), str(code).zfill(6)):
            return True
    return False


def provisioning_uri(secret: str, username: str, issuer: str = "4VELO Admin") -> str:
    from urllib.parse import quote

    label = quote(f"{issuer}:{username}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&digits=6"
