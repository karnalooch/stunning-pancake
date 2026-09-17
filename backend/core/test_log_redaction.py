from __future__ import annotations

import io
import logging

from core.log_redaction import REDACTED, redact_sentry_event, redact_text, redact_value


def test_redact_text_removes_secret_identity_and_gps_canaries():
    canaries = {
        "bearer": "Bearer pilot-super-secret-token",
        "jwt": "eyJabcdefghijk.abcdefghijkl.abcdefghijkl",
        "email": "rider@example.invalid",
        "url_password": "postgres://pilot_user:pilot_password@db:5432/fourvelo",
        "latitude": "52.167123",
        "longitude": "22.290456",
    }
    message = (
        f"authorization={canaries['bearer']} token={canaries['jwt']} "
        f"email={canaries['email']} db={canaries['url_password']} "
        f"lat={canaries['latitude']} lon={canaries['longitude']}"
    )

    redacted = redact_text(message)

    assert REDACTED in redacted
    for canary in canaries.values():
        assert canary not in redacted


def test_redact_value_scrubs_nested_sensitive_and_location_keys():
    payload = {
        "request": {
            "headers": {"Authorization": "Bearer abcdef123456"},
            "user_id": 99123,
            "safe_counter": 7,
        },
        "telemetry": {
            "coordinates": [52.167123, 22.290456],
            "speed": 9.4,
        },
    }

    redacted = redact_value(payload)

    assert redacted["request"]["headers"]["Authorization"] == REDACTED
    assert redacted["request"]["user_id"] == REDACTED
    assert redacted["request"]["safe_counter"] == 7
    assert redacted["telemetry"]["coordinates"] == REDACTED
    assert redacted["telemetry"]["speed"] == 9.4


def test_sentry_before_send_uses_same_redaction_policy():
    event = {
        "request": {
            "headers": {"authorization": "Bearer sentry-canary"},
            "data": {"latitude": 52.1, "longitude": 22.2, "email": "pilot@example.invalid"},
        },
        "message": "refresh_token=sentry-refresh-canary",
    }

    scrubbed = redact_sentry_event(event, hint={"ignored": True})
    serialized = repr(scrubbed)

    assert "sentry-canary" not in serialized
    assert "sentry-refresh-canary" not in serialized
    assert "pilot@example.invalid" not in serialized
    assert "52.1" not in serialized
    assert "22.2" not in serialized
    assert REDACTED in serialized


def test_installed_logging_factory_scrubs_rendered_log_message():
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    logger = logging.getLogger("t71.redaction.canary")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    logger.addHandler(handler)

    try:
        logger.warning(
            "user_id=%s email=%s lat=%s lon=%s authorization=%s",
            99123,
            "pilot@example.invalid",
            52.167123,
            22.290456,
            "Bearer runtime-canary",
        )
    finally:
        logger.removeHandler(handler)

    output = stream.getvalue()
    for canary in (
        "99123",
        "pilot@example.invalid",
        "52.167123",
        "22.290456",
        "runtime-canary",
    ):
        assert canary not in output
    assert REDACTED in output
