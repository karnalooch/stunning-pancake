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
    _validate_bearer,
    jwt_enforced,
)


async def _ingest_ok(request: Request) -> PlainTextResponse:
    return PlainTextResponse("ok")


def _mini_app() -> Starlette:
    app = Starlette(
        routes=[Route("/api/telemetry/ingest", _ingest_ok, methods=["POST"])],
    )
    app.add_middleware(IngestJwtMiddleware)
    return app


def _make_token(secret: str) -> str:
    import jwt

    exp = datetime.now(UTC) + timedelta(hours=1)
    return jwt.encode({"sub": "42", "exp": exp}, secret, algorithm="HS256")


def test_ingest_path_detection():
    assert _is_ingest_path("/api/telemetry/ingest")
    assert _is_ingest_path("/api/telemetry/ingest/batch")
    assert not _is_ingest_path("/api/telemetry/health")


def test_validate_bearer_roundtrip():
    secret = "x" * 32
    token = _make_token(secret)
    assert _validate_bearer(token, secret) is True
    assert _validate_bearer(token, "wrong" * 8) is False


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
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", secret)
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    token = _make_token(secret)

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
            headers={"Authorization": f"Bearer {_make_token(secret)}"},
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
