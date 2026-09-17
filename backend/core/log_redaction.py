"""Central runtime redaction for logs and error-reporting payloads.

T71/DS-017 treats secrets, direct identifiers and precise location as data that
must not leave the process through ordinary logs or Sentry event payloads.
The redactor is intentionally conservative: losing a little diagnostic detail
is preferable to leaking pilot data.
"""

from __future__ import annotations

import logging
import re
import traceback
from collections.abc import Mapping
from typing import Any

REDACTED = "[REDACTED]"
_MAX_DEPTH = 8

_SENSITIVE_KEYS = frozenset(
    {
        "authorization",
        "proxy_authorization",
        "token",
        "access_token",
        "refresh_token",
        "id_token",
        "password",
        "passwd",
        "secret",
        "secret_key",
        "api_key",
        "apikey",
        "cookie",
        "set_cookie",
        "session",
        "sessionid",
        "csrfmiddlewaretoken",
        "email",
        "username",
        "user_id",
        "userid",
        "device_id",
        "deviceid",
        "ip",
        "ip_address",
    }
)
_LOCATION_KEYS = frozenset(
    {
        "lat",
        "latitude",
        "lon",
        "lng",
        "longitude",
        "coordinates",
        "coordinate",
        "gps",
        "location",
        "position",
        "route_path",
    }
)
_REDACT_KEYS = _SENSITIVE_KEYS | _LOCATION_KEYS

_BEARER_RE = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+")
_JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")
_EMAIL_RE = re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")
_URL_CREDENTIALS_RE = re.compile(r"(?i)(\b[a-z][a-z0-9+.-]*://)[^\s/@:]+:[^\s/@]+@")
_KEY_VALUE_RE = re.compile(
    r"(?ix)"
    r"(?P<prefix>[\"']?(?:authorization|proxy_authorization|token|access_token|"
    r"refresh_token|id_token|password|passwd|secret|secret_key|api_key|apikey|"
    r"cookie|set_cookie|session|sessionid|csrfmiddlewaretoken|email|username|"
    r"user_id|userid|device_id|deviceid|ip|ip_address|lat|latitude|lon|lng|"
    r"longitude|coordinates|coordinate|gps|location|position|route_path)"
    r"[\"']?\s*[:=]\s*[\"']?)"
    r"(?P<value>(?!\[REDACTED\])[^\s,;}\"']+)"
)
_GEO_URI_RE = re.compile(r"(?i)\bgeo:-?\d{1,3}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?(?:;[^\s]*)?")

_INSTALLED = False
_ORIGINAL_FACTORY = logging.getLogRecordFactory()


def _normalise_key(key: object) -> str:
    return str(key).strip().lower().replace("-", "_")


def redact_text(value: str) -> str:
    """Remove common secret, identity and precise-location canaries from text."""

    text = _BEARER_RE.sub("Bearer [REDACTED]", value)
    text = _JWT_RE.sub(REDACTED, text)
    text = _URL_CREDENTIALS_RE.sub(r"\1[REDACTED]@", text)
    text = _EMAIL_RE.sub(REDACTED, text)
    text = _GEO_URI_RE.sub("geo:[REDACTED]", text)
    return _KEY_VALUE_RE.sub(lambda match: f"{match.group('prefix')}{REDACTED}", text)


def redact_value(value: Any, *, _depth: int = 0, _seen: set[int] | None = None) -> Any:
    """Recursively redact structured values without mutating the caller's object."""

    if _depth >= _MAX_DEPTH:
        return REDACTED
    if isinstance(value, str):
        return redact_text(value)
    if value is None or isinstance(value, (bool, int, float)):
        return value

    if _seen is None:
        _seen = set()
    object_id = id(value)
    if object_id in _seen:
        return REDACTED
    _seen.add(object_id)

    try:
        if isinstance(value, Mapping):
            result: dict[Any, Any] = {}
            for key, item in value.items():
                if _normalise_key(key) in _REDACT_KEYS:
                    result[key] = REDACTED
                else:
                    result[key] = redact_value(item, _depth=_depth + 1, _seen=_seen)
            return result
        if isinstance(value, tuple):
            return tuple(redact_value(item, _depth=_depth + 1, _seen=_seen) for item in value)
        if isinstance(value, list):
            return [redact_value(item, _depth=_depth + 1, _seen=_seen) for item in value]
        if isinstance(value, set):
            return {redact_value(item, _depth=_depth + 1, _seen=_seen) for item in value}
        return redact_text(str(value))
    finally:
        _seen.discard(object_id)


def redact_sentry_event(event: dict[str, Any], hint: dict[str, Any] | None = None) -> dict[str, Any]:
    """Sentry ``before_send`` hook; ``hint`` is intentionally not emitted."""

    del hint
    redacted = redact_value(event)
    return redacted if isinstance(redacted, dict) else {}


def install_log_redaction() -> None:
    """Install one process-wide LogRecord factory that scrubs rendered messages."""

    global _INSTALLED
    if _INSTALLED:
        return

    previous_factory = logging.getLogRecordFactory()

    def redacting_factory(*args: Any, **kwargs: Any) -> logging.LogRecord:
        record = previous_factory(*args, **kwargs)
        try:
            rendered = record.getMessage()
        except Exception:
            rendered = str(record.msg)
        record.msg = redact_text(rendered)
        record.args = ()

        if record.exc_info:
            try:
                record.exc_text = redact_text("".join(traceback.format_exception(*record.exc_info)))
            except Exception:
                record.exc_text = REDACTED
        if record.stack_info:
            record.stack_info = redact_text(record.stack_info)
        return record

    logging.setLogRecordFactory(redacting_factory)
    _INSTALLED = True
