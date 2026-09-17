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


def test_redact_text_removes_coordinate_sequences_as_one_sensitive_value():
    message = "coordinates=[52.167123, 22.290456] route_path=[[52.1, 22.2], [52.3, 22.4]]"

    redacted = redact_text(message)

    for canary in ("52.167123", "22.290456", "52.1", "22.2", "52.3", "22.4"):
        assert canary not in redacted
    assert redacted.count(REDACTED) >= 2


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
            "url": "https://api.invalid/ride?lat=52.1&lon=22.2&token=sentry-query-canary",
            "data": {"latitude": 52.1, "longitude": 22.2, "email": "pilot@example.invalid"},
        },
        "user": {"id": "safe-sdk-key", "user_id": 99123, "email": "pilot@example.invalid"},
        "message": "refresh_token=sentry-refresh-canary",
    }

    scrubbed = redact_sentry_event(event, hint={"ignored": True})
    serialized = repr(scrubbed)

    for canary in (
        "sentry-canary",
        "sentry-query-canary",
        "sentry-refresh-canary",
        "pilot@example.invalid",
        "99123",
        "52.1",
        "22.2",
    ):
        assert canary not in serialized
    assert REDACTED in serialized


def test_installed_logging_factory_scrubs_rendered_message_and_extras():
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
            extra={
                "coordinates": [52.111111, 22.222222],
                "context": {"token": "structured-canary"},
            },
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
