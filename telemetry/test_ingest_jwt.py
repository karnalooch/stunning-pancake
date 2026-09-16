"""Telemetry ingest JWT middleware tests (no DB lifespan)."""

from __future__ import annotations

import os
import sys
from datetime import UTC, datetime, timedelta

import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

sys.path.insert(0, os.path.dirname(__file__))

from ingest_auth import (  # noqa: E402
    IngestJwtMiddleware,
    _is_ingest_path,
    _validate_bearer_with_audience,
    audience_required,
    expected_audience,
    jwt_enforced,
    validate_ingest_claim_scope,
)


async def _ingest_ok(request: Request) -> PlainTextResponse:
    return PlainTextResponse("ok")


def _mini_app() -> Starlette:
    app = Starlette(
        routes=[Route("/api/telemetry/ingest", _ingest_ok, methods=["POST"])],
    )
    app.add_middleware(IngestJwtMiddleware)
    return app


def _make_token(secret: str, *, audience: str | None = None, extra: dict | None = None) -> str:
    import jwt

    exp = datetime.now(UTC) + timedelta(hours=1)
    claims: dict = {"sub": "42", "exp": exp}
    if audience is not None:
        claims["aud"] = audience
    if extra:
        claims.update(extra)
    return jwt.encode(claims, secret, algorithm="HS256")


def test_ingest_path_detection():
    assert _is_ingest_path("/api/telemetry/ingest")
    assert _is_ingest_path("/api/telemetry/ingest/batch")
    assert not _is_ingest_path("/api/telemetry/health")


def test_jwt_not_enforced_by_default(monkeypatch):
    monkeypatch.delenv("TELEMETRY_INGEST_JWT_REQUIRED", raising=False)
    assert jwt_enforced() is False

    with TestClient(_mini_app()) as client:
        resp = client.post("/api/telemetry/ingest")
    assert resp.status_code == 200


def test_ingest_401_without_token_when_required(monkeypatch):
    secret = "y" * 32
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", secret)
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")

    with TestClient(_mini_app()) as client:
        resp = client.post("/api/telemetry/ingest")
    assert resp.status_code == 401


def test_ingest_accepts_valid_jwt_when_required(monkeypatch):
    secret = "z" * 32
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", secret)
    token = _make_token(secret, audience="telemetry")

    with TestClient(_mini_app()) as client:
        resp = client.post(
            "/api/telemetry/ingest",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200


@pytest.mark.parametrize("secret", [None, "", "   "])
def test_required_jwt_without_usable_key_rejects_ingest(monkeypatch, secret):
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("TELEMETRY_INGEST_JWT_SECRET", raising=False)
    if secret is not None:
        monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", secret)
    with TestClient(_mini_app()) as client:
        response = client.post("/api/telemetry/ingest")
    assert response.status_code == 503
    assert response.json() == {"detail": "Ingest authentication unavailable"}


def test_required_jwt_uses_shared_key_fallback(monkeypatch):
    secret = "shared-test-key-" * 4
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.delenv("TELEMETRY_INGEST_JWT_SECRET", raising=False)
    monkeypatch.setenv("SECRET_KEY", secret)
    with TestClient(_mini_app()) as client:
        response = client.post(
            "/api/telemetry/ingest",
            headers={"Authorization": f"Bearer {_make_token(secret, audience='telemetry')}"},
        )
    assert response.status_code == 200


def test_required_jwt_missing_key_does_not_block_health(monkeypatch):
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("TELEMETRY_INGEST_JWT_SECRET", raising=False)
    app = Starlette(routes=[Route("/health", _ingest_ok)])
    app.add_middleware(IngestJwtMiddleware)
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200


@pytest.mark.parametrize("kind", ["expired", "missing-exp", "wrong-algorithm"])
def test_ingest_rejects_invalid_claims_or_algorithm(monkeypatch, kind):
    import jwt

    secret = "invalid-token-test-" * 4
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", secret)
    claims = {"sub": "42", "exp": datetime.now(UTC) + timedelta(hours=1)}
    algorithm = "HS256"
    if kind == "expired":
        claims["exp"] = datetime.now(UTC) - timedelta(hours=1)
    elif kind == "missing-exp":
        del claims["exp"]
    else:
        algorithm = "HS384"
    token = jwt.encode(claims, secret, algorithm=algorithm)
    with TestClient(_mini_app()) as client:
        response = client.post(
            "/api/telemetry/ingest", headers={"Authorization": f"Bearer {token}"}
        )
    assert response.status_code == 401


def test_audience_required_is_default(monkeypatch):
    # Default is OFF — existing deployments must not silently reject telemetry
    # batches on the day the backend ships. Operators opt in once the mobile
    # rollout is complete (see audit: docs/audits/T05_T16_TELEMETRY_AUDIT_2026-09-16.md).
    monkeypatch.delenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", raising=False)
    assert audience_required() is False
    assert expected_audience() == "telemetry"


def test_audience_required_can_be_enabled(monkeypatch):
    monkeypatch.setenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", "1")
    assert audience_required() is True


def test_audience_required_accepts_truthy_values(monkeypatch):
    for value in ("1", "true", "yes"):
        monkeypatch.setenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", value)
        assert audience_required() is True, f"expected True for {value!r}"


def test_audience_override(monkeypatch):
    monkeypatch.setenv("TELEMETRY_INGEST_AUDIENCE", "custom-aud")
    assert expected_audience() == "custom-aud"


def test_ingest_rejects_token_without_audience(monkeypatch):
    secret = "audience-test-key-" * 4
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", secret)
    monkeypatch.setenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", "1")
    token = _make_token(secret)

    with TestClient(_mini_app()) as client:
        response = client.post(
            "/api/telemetry/ingest", headers={"Authorization": f"Bearer {token}"}
        )
    assert response.status_code == 401
    assert response.json() == {"detail": "Audience mismatch"}


def test_ingest_rejects_token_with_wrong_audience(monkeypatch):
    secret = "wrong-aud-test-key-" * 4
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", secret)
    monkeypatch.setenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", "1")
    token = _make_token(secret, audience="django-api")

    with TestClient(_mini_app()) as client:
        response = client.post(
            "/api/telemetry/ingest", headers={"Authorization": f"Bearer {token}"}
        )
    assert response.status_code == 401
    assert response.json() == {"detail": "Audience mismatch"}


def test_ingest_accepts_token_with_correct_audience(monkeypatch):
    secret = "correct-aud-test-key-" * 4
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", secret)
    monkeypatch.setenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", "1")
    token = _make_token(secret, audience="telemetry")

    with TestClient(_mini_app()) as client:
        response = client.post(
            "/api/telemetry/ingest", headers={"Authorization": f"Bearer {token}"}
        )
    assert response.status_code == 200


def test_ingest_accepts_token_with_audience_list_containing_target(monkeypatch):
    import jwt

    secret = "aud-list-test-key-" * 4
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", secret)
    monkeypatch.setenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", "1")
    exp = datetime.now(UTC) + timedelta(hours=1)
    token = jwt.encode(
        {"sub": "42", "exp": exp, "aud": ["django-api", "telemetry"]},
        secret,
        algorithm="HS256",
    )

    with TestClient(_mini_app()) as client:
        response = client.post(
            "/api/telemetry/ingest", headers={"Authorization": f"Bearer {token}"}
        )
    assert response.status_code == 200


def test_ingest_skips_audience_check_when_disabled(monkeypatch):
    secret = "no-aud-test-key-" * 4
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", secret)
    monkeypatch.setenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", "0")
    token = _make_token(secret)

    with TestClient(_mini_app()) as client:
        response = client.post(
            "/api/telemetry/ingest", headers={"Authorization": f"Bearer {token}"}
        )
    assert response.status_code == 200


def test_validate_bearer_with_audience_unit(monkeypatch):
    monkeypatch.setenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", "1")
    secret = "unit-aud-key-" * 4
    ok_token = _make_token(secret, audience="telemetry")
    bad_token = _make_token(secret, audience="django-api")
    no_aud_token = _make_token(secret)

    assert _validate_bearer_with_audience(ok_token, secret, "telemetry") == (True, None)
    assert _validate_bearer_with_audience(bad_token, secret, "telemetry") == (False, "aud")
    assert _validate_bearer_with_audience(no_aud_token, secret, "telemetry") == (False, "aud")
    assert _validate_bearer_with_audience("not-a-jwt", secret, "telemetry") == (False, "invalid")


def test_scoped_token_accepts_only_matching_activity_and_user():
    claims = {"sub": "42", "activity_id": 99, "aud": "telemetry"}

    assert validate_ingest_claim_scope(
        claims,
        activity_id=99,
        user_ids=[42, 42],
        require_scope=True,
    ) == (True, None)
    assert validate_ingest_claim_scope(
        claims,
        activity_id=100,
        user_ids=[42],
        require_scope=True,
    ) == (False, "activity")
    assert validate_ingest_claim_scope(
        claims,
        activity_id=99,
        user_ids=[43],
        require_scope=True,
    ) == (False, "user")


def test_strict_scope_rejects_missing_activity_or_subject():
    assert validate_ingest_claim_scope(
        {"sub": "42", "aud": "telemetry"},
        activity_id=99,
        user_ids=[42],
        require_scope=True,
    ) == (False, "activity")
    assert validate_ingest_claim_scope(
        {"activity_id": 99, "aud": "telemetry"},
        activity_id=99,
        user_ids=[42],
        require_scope=True,
    ) == (False, "user")


def test_legacy_scope_can_roll_out_before_strict_audience_mode():
    assert validate_ingest_claim_scope(
        {"sub": "42"},
        activity_id=99,
        user_ids=[42],
        require_scope=False,
    ) == (True, None)
