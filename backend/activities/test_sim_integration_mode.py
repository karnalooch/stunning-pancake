"""Tests for sim integration test mode (treat synthetic users as production)."""

from unittest.mock import MagicMock, patch

import pytest

from activities.gpx_forensics import is_simulated_activity
from activities.sim_integration_mode import (
    integration_test_mode_info,
    set_integration_test_mode,
    sim_integration_test_mode,
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


def test_integration_mode_env_default(monkeypatch):
    monkeypatch.delenv("SIM_INTEGRATION_TEST_MODE", raising=False)
    with patch("activities.sim_integration_mode._redis_enabled", return_value=None):
        assert sim_integration_test_mode() is False
        assert sim_users_are_synthetic() is True

    monkeypatch.setenv("SIM_INTEGRATION_TEST_MODE", "1")
    with patch("activities.sim_integration_mode._redis_enabled", return_value=None):
        assert sim_integration_test_mode() is True
        assert sim_users_are_synthetic() is False


def test_integration_mode_redis_overrides_env(monkeypatch):
    monkeypatch.setenv("SIM_INTEGRATION_TEST_MODE", "1")
    with patch("activities.sim_integration_mode._redis_enabled", return_value=False):
        assert sim_integration_test_mode() is False


@patch("activities.sim_integration_mode.get_redis")
def test_set_integration_test_mode(mock_redis):
    mock_r = MagicMock()
    mock_redis.return_value = mock_r
    set_integration_test_mode(True)
    mock_r.set.assert_called_once_with("{sim}:integration_test_mode", "1")


def test_is_simulated_activity_respects_integration_mode(activity_like, monkeypatch):
    monkeypatch.setenv("SIM_INTEGRATION_TEST_MODE", "0")
    with patch("activities.sim_integration_mode._redis_enabled", return_value=None):
        assert is_simulated_activity(activity_like) is True

    monkeypatch.setenv("SIM_INTEGRATION_TEST_MODE", "1")
    with patch("activities.sim_integration_mode._redis_enabled", return_value=None):
        assert is_simulated_activity(activity_like) is False


def test_annotate_federated_skips_synthetic_when_integration_mode():
    payload = annotate_federated_payload(
        {"total_users": 1000, "integration_test_mode": True},
    )
    assert payload["data_source"] == "production"
    assert payload.get("synthetic") is False


def test_integration_test_mode_info_keys(monkeypatch):
    monkeypatch.delenv("SIM_INTEGRATION_TEST_MODE", raising=False)
    with patch("activities.sim_integration_mode._redis_enabled", return_value=None):
        info = integration_test_mode_info()
    assert "integration_test_mode" in info
    assert info["integration_test_mode"] is False
