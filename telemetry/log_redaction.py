"""Central log redaction for the standalone telemetry service.

The telemetry container does not import Django's ``core`` package at runtime,
so it keeps a small local copy of the T71 policy rather than depending on the
backend filesystem layout.
"""

from __future__ import annotations

import logging
import re
import traceback
from typing import Any

REDACTED = "[REDACTED]"

_BEARER_RE = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+")
_JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")
_EMAIL_RE = re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")
_URL_CREDENTIALS_RE = re.compile(r"(?i)(\b[a-z][a-z0-9+.-]*://)[^\s/@:]+:[^\s/@]+@")
_COORDINATE_SEQUENCE_RE = re.compile(
    r"(?i)([\"']?(?:coordinates?|gps|location|position|route_path|polyline|gpx|geojson)"
    r"[\"']?\s*[:=]\s*)\[[^\r\n]*\]"
)
_KEY_VALUE_RE = re.compile(
    r"(?ix)"
    r"(?P<prefix>[\"']?(?:authorization|proxy_authorization|token|access_token|"
    r"refresh_token|id_token|password|passwd|secret|secret_key|api_key|apikey|"
    r"cookie|set_cookie|session|sessionid|csrfmiddlewaretoken|email|username|"
    r"user_id|userid|device_id|deviceid|ip|ip_address|lat|latitude|lon|lng|"
    r"longitude|coordinates|coordinate|gps|location|position|route_path|polyline|"
    r"gpx|geojson)"
    r"[\"']?\s*[:=]\s*[\"']?)"
    r"(?P<value>(?!\[REDACTED\])[^\s,;}\"']+)"
)
_GEO_URI_RE = re.compile(r"(?i)\bgeo:-?\d{1,3}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?(?:;[^\s]*)?")
_INSTALLED = False


def redact_text(value: str) -> str:
    """Remove common secret, direct-identity and location canaries from text."""

    text = _BEARER_RE.sub("Bearer [REDACTED]", value)
    text = _JWT_RE.sub(REDACTED, text)
    text = _URL_CREDENTIALS_RE.sub(r"\1[REDACTED]@", text)
    text = _EMAIL_RE.sub(REDACTED, text)
    text = _GEO_URI_RE.sub("geo:[REDACTED]", text)
    text = _COORDINATE_SEQUENCE_RE.sub(lambda match: f"{match.group(1)}{REDACTED}", text)
    return _KEY_VALUE_RE.sub(lambda match: f"{match.group('prefix')}{REDACTED}", text)


def install_log_redaction() -> None:
    """Install one process-wide factory before telemetry logging is configured."""

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
