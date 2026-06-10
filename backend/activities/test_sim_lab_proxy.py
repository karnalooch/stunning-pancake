"""Tests for sim-lab proxy helpers."""

from unittest.mock import MagicMock, patch

import pytest
from rest_framework.test import APIRequestFactory

from activities.sim_lab_proxy import (
    require_sim_lab_reachable,
    annotate_federated_payload,
    annotate_production_payload,
    assert_prod_heavy_sim_allowed,
    dashboard_data_source,
    probe_sim_lab_health,
    sim_lab_proxy_enabled,
    sim_lab_proxy_target_info,
    sim_lab_read_federation_enabled,
    try_forward_sim_lab,
    try_forward_sim_lab_activities,
    try_forward_sim_lab_read,
)


@pytest.fixture(autouse=True)
def _clear_proxy_env(monkeypatch):
    monkeypatch.delenv("SIM_LAB_PROXY_ENABLED", raising=False)
    monkeypatch.delenv("SIM_LAB_PROXY_BASE_URL", raising=False)
    monkeypatch.delenv("SIM_LAB_PROXY_SECRET", raising=False)
    monkeypatch.delenv("SIM_LAB_READ_FEDERATION_ENABLED", raising=False)
    monkeypatch.delenv("SIM_LAB_PROXY_STATS_CACHE_TTL", raising=False)
    monkeypatch.delenv("ALLOW_PROD_HEAVY_SIM", raising=False)


def test_sim_lab_proxy_disabled_by_default():
    assert sim_lab_proxy_enabled() is False
    assert sim_lab_read_federation_enabled() is False
    assert dashboard_data_source() == "production"


def test_sim_lab_proxy_enabled_when_configured(monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    assert sim_lab_proxy_enabled() is True


def test_try_forward_returns_none_when_disabled():
    factory = APIRequestFactory()
    request = factory.get("/api/activities/admin/simulate/")
    assert try_forward_sim_lab(request, "simulate/") is None


def test_try_forward_skipped_with_local_query(monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")

    factory = APIRequestFactory()
    request = factory.get("/api/activities/admin/wipe-data/?local=1")
    assert try_forward_sim_lab(request, "wipe-data/") is None


def test_try_forward_skipped_with_force_local_body(monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")

    factory = APIRequestFactory()
    request = factory.delete(
        "/api/activities/admin/wipe-data/",
        {"confirm": True, "force_local": True},
        format="json",
    )
    assert try_forward_sim_lab(request, "wipe-data/") is None


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


@patch("activities.sim_lab_proxy.requests.request")
def test_try_forward_activities_url_and_query(mock_request, monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    monkeypatch.setenv("SIM_LAB_PROXY_MAP_TIMEOUT", "120")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b'{"positions": []}'
    mock_resp.json.return_value = {"positions": []}
    mock_resp.headers = {"ETag": '"abc"', "Cache-Control": "private, max-age=4"}
    mock_request.return_value = mock_resp

    factory = APIRequestFactory()
    request = factory.get(
        "/api/activities/telemetry/live/?zoom=10&limit=800",
        HTTP_IF_NONE_MATCH='"prev"',
    )
    request.user = MagicMock(username="global_owner")

    proxied = try_forward_sim_lab_activities(request, "telemetry/live/")
    assert proxied is not None
    assert proxied.status_code == 200
    assert proxied.data["sim_lab_proxy"] is True
    assert proxied["ETag"] == '"abc"'

    call_kw = mock_request.call_args.kwargs
    assert call_kw["url"] == (
        "https://sim.example.com/api/activities/telemetry/live/?zoom=10&limit=800"
    )
    assert call_kw["timeout"] == 120
    assert call_kw["headers"]["If-None-Match"] == '"prev"'


@patch("activities.sim_lab_proxy.requests.request")
def test_try_forward_activities_fallback_on_500(mock_request, monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")

    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.content = b"<html>Internal Server Error</html>"
    mock_resp.json.side_effect = ValueError("not json")
    mock_resp.text = "<html>Internal Server Error</html>"
    mock_request.return_value = mock_resp

    factory = APIRequestFactory()
    request = factory.get("/api/activities/telemetry/live/?zoom=6")
    request.user = MagicMock(username="global_owner")

    proxied = try_forward_sim_lab_activities(request, "telemetry/live/", allow_local_fallback=True)
    assert proxied is None


@patch("activities.sim_lab_proxy.requests.request")
def test_try_forward_post_serializes_parsed_data(mock_request, monkeypatch):
    """POST must forward JSON after DRF consumed the raw stream (no RawPostDataException)."""
    import json

    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b'{"status":"started"}'
    mock_resp.json.return_value = {"status": "started"}
    mock_request.return_value = mock_resp

    from rest_framework.parsers import JSONParser
    from rest_framework.request import Request

    factory = APIRequestFactory()
    django_req = factory.post(
        "/api/activities/admin/simulate/",
        {"total_users": 100, "skip_activities": True},
        format="json",
    )
    django_req.user = MagicMock(username="global_owner")
    drf_req = Request(django_req, parsers=[JSONParser()])
    assert drf_req.data["total_users"] == 100

    proxied = try_forward_sim_lab(drf_req, "simulate/")
    assert proxied is not None
    assert proxied.status_code == 200

    sent = json.loads(mock_request.call_args.kwargs["data"].decode())
    assert sent["total_users"] == 100
    assert sent["skip_activities"] is True


@patch("activities.sim_lab_proxy.requests.get")
def test_probe_sim_lab_health_reachable(mock_get, monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = ""
    mock_get.return_value = mock_resp

    result = probe_sim_lab_health(force=True)
    assert result["reachable"] is True
    assert result["status_code"] == 200
    assert result["latency_ms"] is not None


@patch("activities.sim_lab_proxy.requests.get")
def test_probe_sim_lab_health_unreachable(mock_get, monkeypatch):
    import requests

    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    mock_get.side_effect = requests.Timeout("timed out")

    result = probe_sim_lab_health(force=True)
    assert result["reachable"] is False
    assert result["error"]


@patch("activities.sim_lab_proxy.requests.request")
def test_try_forward_simulate_get_falls_back_on_upstream_500(mock_request, monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")

    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.content = b"Internal Server Error"
    mock_resp.text = "Internal Server Error"
    mock_resp.json.side_effect = ValueError("not json")
    mock_request.return_value = mock_resp

    factory = APIRequestFactory()
    request = factory.get("/api/activities/admin/simulate/")
    request.user = MagicMock(username="global_owner")

    proxied = try_forward_sim_lab(request, "simulate/", allow_local_fallback=True)
    assert proxied is None


@patch("activities.sim_lab_proxy.probe_sim_lab_health", return_value={"reachable": False})
def test_try_forward_simulate_get_skips_proxy_when_health_down(_health, monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")

    factory = APIRequestFactory()
    request = factory.get("/api/activities/admin/simulate/")
    request.user = MagicMock(username="global_owner")

    proxied = try_forward_sim_lab(request, "simulate/", allow_local_fallback=True)
    assert proxied is None


def test_require_sim_lab_reachable_blocks_when_down(monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")

    with patch("activities.sim_lab_proxy.probe_sim_lab_health", return_value={"reachable": False}):
        resp = require_sim_lab_reachable()
    assert resp is not None
    assert resp.status_code == 503
    assert resp.data["code"] == "SIM_LAB_UNREACHABLE"


def test_sim_lab_proxy_target_info_includes_health(monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")

    with patch("activities.sim_lab_proxy.probe_sim_lab_health", return_value={"reachable": True}):
        info = sim_lab_proxy_target_info()
    assert info["sim_lab_health"]["reachable"] is True
    assert info["read_federation_enabled"] is False
    assert info["dashboard_data_source"] == "production"


def test_sim_lab_read_federation_enabled_requires_proxy(monkeypatch):
    monkeypatch.setenv("SIM_LAB_READ_FEDERATION_ENABLED", "1")
    assert sim_lab_read_federation_enabled() is False

    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    assert sim_lab_read_federation_enabled() is True
    assert dashboard_data_source() == "sim-lab"


def test_annotate_federated_payload():
    payload = annotate_federated_payload({"total_users": 20000})
    assert payload["data_source"] == "sim-lab"
    assert payload["synthetic"] is True
    assert payload["sim_lab_proxy"] is True


def test_annotate_production_payload():
    payload = annotate_production_payload({"total_users": 10})
    assert payload["data_source"] == "production"
    assert payload["synthetic"] is False


@patch("activities.sim_lab_proxy.requests.get")
@patch("activities.sim_lab_proxy.probe_sim_lab_health")
def test_fetch_sim_lab_admin_json(mock_health, mock_get, monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    mock_health.return_value = {"reachable": True}
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b'{"running": true}'
    mock_resp.json.return_value = {"running": True, "currently_riding": 12}
    mock_get.return_value = mock_resp

    from activities.sim_lab_proxy import fetch_sim_lab_admin_json

    payload = fetch_sim_lab_admin_json("live-simulate/", query="?light=1")
    assert payload["running"] is True
    assert payload["currently_riding"] == 12
    assert "live-simulate" in mock_get.call_args.args[0]


def test_try_forward_read_returns_none_when_federation_disabled():
    factory = APIRequestFactory()
    request = factory.get("/api/activities/admin/stats/")
    assert try_forward_sim_lab_read(request, "stats/") is None


@patch("activities.sim_lab_proxy.requests.request")
def test_try_forward_read_stats(mock_request, monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    monkeypatch.setenv("SIM_LAB_READ_FEDERATION_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_PUBLIC_LABEL", "test-sim-lab")
    monkeypatch.setenv("SIM_LAB_PROXY_STATS_CACHE_TTL", "0")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b'{"total_users": 20000}'
    mock_resp.json.return_value = {"total_users": 20000}
    mock_request.return_value = mock_resp

    factory = APIRequestFactory()
    request = factory.get("/api/activities/admin/stats/?refresh=1")
    request.user = MagicMock(username="global_owner", role="GLOBAL_OWNER", tenant_id=None)

    proxied = try_forward_sim_lab_read(request, "stats/")
    assert proxied is not None
    assert proxied.status_code == 200
    assert proxied.data["total_users"] == 20000
    assert proxied.data["data_source"] == "sim-lab"
    assert proxied.data["synthetic"] is True
    assert proxied.data["sim_lab_label"] == "test-sim-lab"

    call_kw = mock_request.call_args.kwargs
    assert call_kw["url"] == "https://sim.example.com/api/activities/admin/stats/?refresh=1"


@patch("activities.sim_lab_proxy.requests.request")
def test_try_forward_read_fallback_on_timeout(mock_request, monkeypatch):
    import requests

    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    monkeypatch.setenv("SIM_LAB_READ_FEDERATION_ENABLED", "1")
    mock_request.side_effect = requests.Timeout("timed out")

    factory = APIRequestFactory()
    request = factory.get("/api/activities/admin/stats/")
    request.user = MagicMock(username="global_owner")

    proxied = try_forward_sim_lab_read(request, "stats/", allow_local_fallback=True)
    assert proxied is None


@patch("activities.sim_lab_proxy.requests.request")
def test_try_forward_activities_aggregate_fallback_on_timeout(mock_request, monkeypatch):
    import requests

    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    mock_request.side_effect = requests.Timeout("timed out")

    factory = APIRequestFactory()
    request = factory.get("/api/activities/telemetry/live/aggregate/?bbox=1,2,3,4")
    request.user = MagicMock(username="global_owner")

    proxied = try_forward_sim_lab_activities(
        request,
        "telemetry/live/aggregate/",
        timeout=4,
        allow_local_fallback=True,
    )
    assert proxied is None


@patch("activities.sim_lab_proxy.requests.request")
def test_try_forward_activities_passthrough_304(mock_request, monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")

    mock_resp = MagicMock()
    mock_resp.status_code = 304
    mock_resp.content = b""
    mock_resp.headers = {"ETag": '"xyz"', "Cache-Control": "private, max-age=8"}
    mock_request.return_value = mock_resp

    factory = APIRequestFactory()
    request = factory.get("/api/activities/telemetry/live/?zoom=6")
    request.user = MagicMock(username="global_owner")

    proxied = try_forward_sim_lab_activities(request, "telemetry/live/")
    assert proxied.status_code == 304
    assert proxied["ETag"] == '"xyz"'
