"""WebSocket ingest authentication tests (mirrors IngestJwtMiddleware).

WS handshake does not carry Authorization headers (browser WebSocket API
limitation) so the route accepts ``?token=...`` query parameter and
validates it with the same audience-scoped JWT used by HTTP. Reject codes:

- 1008: policy violation (generic)
- 1011: server unavailable (no secret configured)
- 4401: unauthorized (custom code in the 4xxx range)

We test the WS auth logic via a tiny shim app instead of the full
telemetry stack so the suite stays fast and isolated from asyncpg /
Postgres / Redis. The production route lives in ``routes.py`` and uses
the same helpers.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt as pyjwt
import pytest
from fastapi import FastAPI, Query, WebSocket
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from ingest_auth import (
    _validate_bearer_with_audience,
    audience_required,
    expected_audience,
    jwt_enforced,
    jwt_secret,
)


@pytest.fixture(autouse=True)
def _clear_env(monkeypatch):
    """jwt_enforced / jwt_secret read env at runtime. Wipe leftovers so a
    test that sets `TELEMETRY_INGEST_JWT_REQUIRED=1` does not leak into
    the next one."""
    for var in (
        "TELEMETRY_INGEST_JWT_REQUIRED",
        "TELEMETRY_INGEST_JWT_SECRET",
        "TELEMETRY_INGEST_AUDIENCE_REQUIRED",
        "SECRET_KEY",
    ):
        monkeypatch.delenv(var, raising=False)


def _make_token(secret: str, *, audience: str | None = None) -> str:
    return pyjwt.encode(
        {
            "sub": "42",
            "exp": datetime.now(UTC) + timedelta(hours=1),
            **({"aud": audience} if audience else {}),
        },
        secret,
        algorithm="HS256",
    )


def _build_shim_app() -> FastAPI:
    """Minimal app that wires the same auth logic as ``routes.websocket_ingest``.
    Keep in sync with the production route."""
    app = FastAPI()

    @app.websocket("/ws/telemetry/ingest")
    async def ws(websocket: WebSocket, token: str | None = Query(default=None)) -> None:
        if jwt_enforced():
            secret = jwt_secret()
            if not secret:
                await websocket.close(code=1011, reason="Ingest authentication unavailable")
                return
            if not token:
                await websocket.close(code=4401, reason="Authorization required")
                return
            ok, reason = _validate_bearer_with_audience(token, secret, expected_audience())
            if not ok:
                detail = (
                    "Audience mismatch"
                    if audience_required() and reason == "aud"
                    else "Invalid or expired token"
                )
                await websocket.close(code=4401, reason=detail)
                return
        await websocket.accept()
        await websocket.send_json({"type": "pong", "ack": True})
        await websocket.close()

    return app


@pytest.fixture
def shim_app():
    return _build_shim_app()


def test_shim_app_ws_accepts_when_jwt_not_required(shim_app):
    with TestClient(shim_app) as c:
        with c.websocket_connect("/ws/telemetry/ingest") as ws:
            ack = ws.receive_json()
            assert ack["ack"] is True


def test_shim_app_ws_rejects_without_token_when_required(monkeypatch, shim_app):
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", "ws-secret-key-1234567890")
    with TestClient(shim_app) as c:
        with pytest.raises(WebSocketDisconnect) as ei:
            with c.websocket_connect("/ws/telemetry/ingest"):
                pass
    assert ei.value.code == 4401


def test_shim_app_ws_rejects_wrong_audience(monkeypatch, shim_app):
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", "ws-secret-key-1234567890")
    monkeypatch.setenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", "1")
    token = _make_token("ws-secret-key-1234567890", audience="django-api")
    with TestClient(shim_app) as c:
        with pytest.raises(WebSocketDisconnect) as ei:
            with c.websocket_connect(f"/ws/telemetry/ingest?token={token}"):
                pass
    assert ei.value.code == 4401
    assert ei.value.reason == "Audience mismatch"


def test_shim_app_ws_rejects_invalid_token_as_invalid_not_audience(monkeypatch, shim_app):
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", "ws-secret-key-1234567890")
    monkeypatch.setenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", "1")
    with TestClient(shim_app) as c:
        with pytest.raises(WebSocketDisconnect) as ei:
            with c.websocket_connect("/ws/telemetry/ingest?token=not-a-valid-jwt"):
                pass
    assert ei.value.code == 4401
    assert ei.value.reason == "Invalid or expired token"


def test_shim_app_ws_accepts_correct_token_and_audience(monkeypatch, shim_app):
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", "ws-secret-key-1234567890")
    monkeypatch.setenv("TELEMETRY_INGEST_AUDIENCE_REQUIRED", "1")
    token = _make_token("ws-secret-key-1234567890", audience="telemetry")
    with TestClient(shim_app) as c:
        with c.websocket_connect(f"/ws/telemetry/ingest?token={token}") as ws:
            ack = ws.receive_json()
            assert ack["ack"] is True


def test_shim_app_ws_accepts_when_audience_not_required(monkeypatch, shim_app):
    """Backward-compatible: token without aud claim is accepted if
    TELEMETRY_INGEST_AUDIENCE_REQUIRED is unset / 0."""
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "1")
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", "ws-secret-key-1234567890")
    token = _make_token("ws-secret-key-1234567890")
    with TestClient(shim_app) as c:
        with c.websocket_connect(f"/ws/telemetry/ingest?token={token}") as ws:
            ack = ws.receive_json()
            assert ack["ack"] is True
