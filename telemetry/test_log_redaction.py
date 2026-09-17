from __future__ import annotations

import io
import logging

from log_redaction import REDACTED, install_log_redaction, redact_text


def test_redact_text_removes_telemetry_canaries():
    message = (
        "authorization=Bearer telemetry-token email=rider@example.invalid "
        "user_id=8844 device_id=pilot-phone lat=52.167123 lon=22.290456 "
        "db=postgres://pilot:password@db:5432/fourvelo"
    )

    redacted = redact_text(message)

    for canary in (
        "telemetry-token",
        "rider@example.invalid",
        "8844",
        "pilot-phone",
        "52.167123",
        "22.290456",
        "pilot:password",
    ):
        assert canary not in redacted
    assert REDACTED in redacted


def test_log_record_factory_scrubs_formatted_runtime_values():
    install_log_redaction()
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    logger = logging.getLogger("telemetry.t71.canary")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    logger.addHandler(handler)

    try:
        logger.info(
            "activity event user_id=%s lat=%s lon=%s token=%s",
            8844,
            52.167123,
            22.290456,
            "telemetry-runtime-token",
        )
    finally:
        logger.removeHandler(handler)

    output = stream.getvalue()
    for canary in ("8844", "52.167123", "22.290456", "telemetry-runtime-token"):
        assert canary not in output
    assert REDACTED in output
