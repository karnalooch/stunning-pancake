"""Telemetry ingest JWT middleware tests (no DB lifespan)."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

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

    exp = datetime.now(timezone.utc) + timedelta(hours=1)
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
