"""Tests for sim-lab proxy helpers."""

import os
from unittest.mock import MagicMock, patch

import pytest
from rest_framework.test import APIRequestFactory

from activities.sim_lab_proxy import (
    assert_prod_heavy_sim_allowed,
    sim_lab_proxy_enabled,
    try_forward_sim_lab,
)


@pytest.fixture(autouse=True)
def _clear_proxy_env(monkeypatch):
    monkeypatch.delenv("SIM_LAB_PROXY_ENABLED", raising=False)
    monkeypatch.delenv("SIM_LAB_PROXY_BASE_URL", raising=False)
    monkeypatch.delenv("SIM_LAB_PROXY_SECRET", raising=False)
    monkeypatch.delenv("ALLOW_PROD_HEAVY_SIM", raising=False)


def test_sim_lab_proxy_disabled_by_default():
    assert sim_lab_proxy_enabled() is False


def test_sim_lab_proxy_enabled_when_configured(monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    assert sim_lab_proxy_enabled() is True


def test_try_forward_returns_none_when_disabled():
    factory = APIRequestFactory()
    request = factory.get("/api/activities/admin/simulate/")
    assert try_forward_sim_lab(request, "simulate/") is None


@patch("activities.sim_lab_proxy.requests.request")
def test_try_forward_returns_response(mock_request, monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b'{"running": false}'
    mock_resp.json.return_value = {"running": False}
    mock_request.return_value = mock_resp

    factory = APIRequestFactory()
    request = factory.get("/api/activities/admin/simulate/")
    request.user = MagicMock(username="global_owner")

    proxied = try_forward_sim_lab(request, "simulate/")
    assert proxied is not None
    assert proxied.status_code == 200
    assert proxied.data["sim_lab_proxy"] is True


def test_prod_heavy_sim_blocked_without_proxy(monkeypatch):
    monkeypatch.setenv("PROD_MAX_BATCH_USERS", "10000")
    blocked = assert_prod_heavy_sim_allowed(total_users=50_000)
    assert blocked is not None
    assert blocked.status_code == 403


def test_prod_heavy_sim_allowed_with_proxy(monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    assert assert_prod_heavy_sim_allowed(total_users=300_000) is None


def test_prod_heavy_sim_allowed_on_sim_lab_tenant(monkeypatch):
    monkeypatch.setenv("SENTRY_ENVIRONMENT", "sim-lab")
    assert assert_prod_heavy_sim_allowed(total_users=300_000) is None
