"""Railway OSRM numReplicas lifecycle (mocked GraphQL)."""

from __future__ import annotations

import json
from io import BytesIO
from unittest.mock import patch

import pytest

from activities import railway_osrm_lifecycle as lifecycle

pytestmark = pytest.mark.simulator_light


@pytest.fixture(autouse=True)
def _clear_service_cache():
    lifecycle._SERVICE_ID_CACHE = None
    yield
    lifecycle._SERVICE_ID_CACHE = None


class TestLifecycleEnabled:
    def test_disabled_on_sqlite(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "sqlite:///x.db")
        monkeypatch.setenv("RAILWAY_API_TOKEN", "tok")
        assert lifecycle.lifecycle_enabled() is False

    def test_disabled_explicit_off(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgres://x")
        monkeypatch.setenv("RAILWAY_API_TOKEN", "tok")
        monkeypatch.setenv("RAILWAY_OSRM_LIFECYCLE", "0")
        assert lifecycle.lifecycle_enabled() is False

    def test_enabled_with_token(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgres://x")
        monkeypatch.setenv("RAILWAY_API_TOKEN", "tok")
        monkeypatch.delenv("RAILWAY_OSRM_LIFECYCLE", raising=False)
        assert lifecycle.lifecycle_enabled() is True


class TestScaleOsrm:
    def test_skipped_without_token(self, monkeypatch):
        monkeypatch.delenv("RAILWAY_API_TOKEN", raising=False)
        monkeypatch.setenv("DATABASE_URL", "postgres://x")
        out = lifecycle.scale_osrm_for_live_sim(running=True)
        assert out.action == "skipped"

    @patch.dict("os.environ", {"SCALE_SIM_ROUTING_BACKEND": "brouter"}, clear=False)
    def test_skipped_when_brouter_only(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgres://x")
        monkeypatch.setenv("RAILWAY_API_TOKEN", "tok")
        out = lifecycle.scale_osrm_for_live_sim(running=True)
        assert out.action == "skipped"
        assert out.detail == "routing_backend_not_osrm"

    @patch.dict("os.environ", {"SCALE_SIM_ROUTING_BACKEND": "osrm"}, clear=False)
    @patch("activities.sim_live_guards.wait_for_osrm_ready")
    @patch("activities.railway_osrm_lifecycle.set_osrm_replicas", return_value=True)
    def test_scaled_up(self, mock_set, mock_wait, monkeypatch):
        from activities.sim_live_guards import OsrmReadyWaitResult

        monkeypatch.setenv("DATABASE_URL", "postgres://x")
        monkeypatch.setenv("RAILWAY_API_TOKEN", "tok")
        monkeypatch.setenv("RAILWAY_OSRM_SERVICE_ID", "svc-uuid")
        mock_wait.return_value = OsrmReadyWaitResult(True, 12.0, 3)
        out = lifecycle.scale_osrm_for_live_sim(running=True)
        assert out.action == "scaled_up"
        assert out.replicas == 1
        assert out.osrm_ready is True
        mock_set.assert_called_once_with(1)

    @patch("activities.railway_osrm_lifecycle.set_osrm_replicas")
    def test_scaled_down_always_when_enabled(self, mock_set, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgres://x")
        monkeypatch.setenv("RAILWAY_API_TOKEN", "tok")
        monkeypatch.setenv("RAILWAY_OSRM_SERVICE_ID", "svc-uuid")
        monkeypatch.setenv("SCALE_SIM_ROUTING_BACKEND", "brouter")
        mock_set.return_value = True
        out = lifecycle.scale_osrm_for_live_sim(running=False)
        assert out.action == "scaled_down"
        mock_set.assert_called_once_with(0)


class TestGraphQL:
    @patch("urllib.request.urlopen")
    def test_resolve_service_id_from_env(self, mock_urlopen, monkeypatch):
        monkeypatch.setenv("RAILWAY_OSRM_SERVICE_ID", "explicit-id")
        assert lifecycle.resolve_osrm_service_id() == "explicit-id"
        mock_urlopen.assert_not_called()

    @patch("urllib.request.urlopen")
    def test_resolve_service_id_lookup(self, mock_urlopen, monkeypatch):
        monkeypatch.delenv("RAILWAY_OSRM_SERVICE_ID", raising=False)
        payload = {
            "data": {
                "project": {
                    "services": {
                        "edges": [{"node": {"id": "found-id", "name": "osrm"}}]
                    }
                }
            }
        }
        mock_urlopen.return_value.__enter__.return_value = BytesIO(
            json.dumps(payload).encode()
        )
        assert lifecycle.resolve_osrm_service_id() == "found-id"
