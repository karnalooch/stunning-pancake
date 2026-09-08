"""Tests for sim data-plane modes (prod-local vs sim-lab heuristics)."""

from unittest.mock import MagicMock, patch

import pytest

from activities.gpx_forensics import is_simulated_activity
from activities.sim_integration_mode import (
    integration_test_mode_info,
    prod_local_writes_info,
    set_prod_local_writes,
    sim_data_plane,
    sim_prod_local_writes,
    sim_users_are_synthetic,
)
from activities.sim_lab_proxy import annotate_federated_payload


@pytest.fixture
def activity_like():
    user = MagicMock()
    user.username = "sim_athlete_1"
    activity = MagicMock()
    activity.user = user
    activity.tenant = None
    activity.external_id = ""
    return activity


def test_prod_local_writes_on_prod_with_proxy(monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    monkeypatch.delenv("SIM_PROD_LOCAL_WRITES", raising=False)
    with patch("activities.sim_integration_mode._redis_flag", return_value=None):
        assert sim_prod_local_writes() is False
        assert sim_data_plane() == "sim-lab"

    with patch("activities.sim_integration_mode._redis_flag", return_value=True):
        assert sim_prod_local_writes() is True
        assert sim_data_plane() == "production"
        assert sim_users_are_synthetic() is False


def test_prod_local_default_when_proxy_off(monkeypatch):
    monkeypatch.delenv("SIM_LAB_PROXY_ENABLED", raising=False)
    with patch("activities.sim_integration_mode._redis_flag", return_value=None):
        assert sim_prod_local_writes() is True


@patch("activities.sim_integration_mode.get_redis")
def test_set_prod_local_writes(mock_redis):
    mock_r = MagicMock()
    mock_redis.return_value = mock_r
    set_prod_local_writes(True)
    mock_r.set.assert_called_once_with("{sim}:prod_local_writes", "1")


def test_is_simulated_activity_respects_prod_local(activity_like, monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    with patch("activities.sim_integration_mode._redis_flag") as mock_flag:
        mock_flag.side_effect = lambda key: False if key.endswith("integration_test_mode") else True
        assert is_simulated_activity(activity_like) is False


def test_annotate_federated_skips_synthetic_when_integration_mode():
    payload = annotate_federated_payload(
        {"total_users": 1000, "integration_test_mode": True},
    )
    assert payload["data_source"] == "production"
    assert payload.get("synthetic") is False


def test_prod_local_writes_info_editable(monkeypatch):
    monkeypatch.setenv("SIM_LAB_PROXY_ENABLED", "1")
    monkeypatch.setenv("SIM_LAB_PROXY_BASE_URL", "https://sim.example.com")
    monkeypatch.setenv("SIM_LAB_PROXY_SECRET", "secret")
    with patch("activities.sim_integration_mode._redis_flag", return_value=None):
        info = prod_local_writes_info()
    assert info["prod_local_editable"] is True


def test_integration_test_mode_info_keys(monkeypatch):
    monkeypatch.delenv("SIM_INTEGRATION_TEST_MODE", raising=False)
    with patch("activities.sim_integration_mode._redis_flag", return_value=None):
        info = integration_test_mode_info()
    assert info["integration_test_mode"] is False
