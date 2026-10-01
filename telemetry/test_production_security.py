"""Startup authority tests; lifespan DB/Redis/worker boundaries are mocked.

These are deterministic runtime/unit proofs, not live deployment evidence.
"""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

sys.path.insert(0, os.path.dirname(__file__))

from production_security import (  # noqa: E402
    assert_production_security,
    production_security_required,
)

ENV_MARKERS = ("SENTRY_ENVIRONMENT", "RAILWAY_ENVIRONMENT", "RAILWAY_ENVIRONMENT_NAME")
PAAS_MARKERS = (
    "RAILWAY_SERVICE_NAME",
    "RAILWAY_SERVICE_ID",
    "RAILWAY_PROJECT_ID",
    "RAILWAY_ENVIRONMENT_ID",
    "DYNO",
    "RENDER",
    "RENDER_SERVICE_ID",
)
FLAGS = ("TELEMETRY_INGEST_JWT_REQUIRED", "TELEMETRY_INGEST_AUDIENCE_REQUIRED")
KEYS = ("TELEMETRY_INGEST_JWT_SECRET", "SECRET_KEY")


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch):
    for name in ENV_MARKERS + PAAS_MARKERS + FLAGS + KEYS:
        monkeypatch.delenv(name, raising=False)


def configure_secure(monkeypatch):
    monkeypatch.setenv("SENTRY_ENVIRONMENT", "production")
    for flag in FLAGS:
        monkeypatch.setenv(flag, "1")
    monkeypatch.setenv("SECRET_KEY", "unit-test-only-signing-key-" * 3)


@pytest.mark.parametrize("marker", ENV_MARKERS)
@pytest.mark.parametrize("value", ["production", " ProD "])
def test_each_production_environment_is_independent(monkeypatch, marker, value):
    monkeypatch.setenv("SENTRY_ENVIRONMENT", "staging")
    monkeypatch.setenv(marker, value)
    assert production_security_required()
    with pytest.raises(RuntimeError, match="Production telemetry requires"):
        assert_production_security()


@pytest.mark.parametrize("marker", PAAS_MARKERS)
def test_paas_requires_security_even_with_debug_and_skips(monkeypatch, marker):
    monkeypatch.setenv(marker, "test-service")
    monkeypatch.setenv("DEBUG", "1")
    monkeypatch.setenv("TELEMETRY_SKIP_DB", "1")
    monkeypatch.setenv("TELEMETRY_SKIP_BROADCAST", "1")
    with pytest.raises(RuntimeError, match="Production telemetry requires"):
        assert_production_security()


def test_local_default_is_unchanged():
    assert not production_security_required()
    assert_production_security()


@pytest.mark.parametrize("flag", FLAGS)
@pytest.mark.parametrize("value", [None, "", "0", "false", "off", "garbage"])
def test_required_flags_fail_closed(monkeypatch, flag, value):
    configure_secure(monkeypatch)
    monkeypatch.delenv(flag)
    if value is not None:
        monkeypatch.setenv(flag, value)
    with pytest.raises(RuntimeError, match=flag):
        assert_production_security()


@pytest.mark.parametrize("value", ["1", "true", "yes", " TRUE "])
def test_existing_truthy_flag_semantics_remain(monkeypatch, value):
    configure_secure(monkeypatch)
    for flag in FLAGS:
        monkeypatch.setenv(flag, value)
    assert_production_security()


@pytest.mark.parametrize("key_name", KEYS)
@pytest.mark.parametrize("value", [None, "", " \t\n", "default-unsafe-key-for-dev"])
def test_missing_or_unusable_authority_fails(monkeypatch, key_name, value):
    configure_secure(monkeypatch)
    monkeypatch.delenv("SECRET_KEY")
    if value is not None:
        monkeypatch.setenv(key_name, value)
    with pytest.raises(RuntimeError, match="usable TELEMETRY_INGEST_JWT_SECRET"):
        assert_production_security()


@pytest.mark.parametrize("key_name", KEYS)
def test_dedicated_or_shared_key_can_satisfy_authority(monkeypatch, key_name):
    configure_secure(monkeypatch)
    monkeypatch.delenv("SECRET_KEY")
    monkeypatch.setenv(key_name, "unit-test-only-key-" * 4)
    assert_production_security()


def test_invalid_explicit_override_is_not_silently_replaced(monkeypatch):
    configure_secure(monkeypatch)
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_SECRET", "   ")
    with pytest.raises(RuntimeError, match="usable TELEMETRY_INGEST_JWT_SECRET"):
        assert_production_security()


def test_error_contains_names_not_key_material(monkeypatch):
    configure_secure(monkeypatch)
    monkeypatch.setenv("TELEMETRY_INGEST_JWT_REQUIRED", "0")
    with pytest.raises(RuntimeError) as caught:
        assert_production_security()
    assert os.environ["SECRET_KEY"] not in str(caught.value)
    assert "TELEMETRY_INGEST_JWT_REQUIRED=1" in str(caught.value)


@pytest.fixture
def isolated_lifecycle(monkeypatch):
    # Execute the actual lifespan module with mocked external resource imports.
    # No DB/Redis/network is reached and sys.modules is restored by monkeypatch.
    boundaries = {
        "bridges": {"traccar_redis_bridge": AsyncMock()},
        "config": {"SKIP_BROADCAST": False, "SKIP_DB": False},
        "db": {
            "close_pool": AsyncMock(),
            "flush_insert_buffer": AsyncMock(),
            "get_pool": AsyncMock(side_effect=RuntimeError("test-database-boundary")),
        },
        "ingest_queue": {
            "queue_enabled": Mock(return_value=False),
            "start_drain_worker": Mock(),
            "stop_drain_worker": AsyncMock(),
        },
        "ingest_service": {"get_ingest_redis": AsyncMock()},
        "privacy": {
            "load_zones_from_rows": Mock(),
            "privacy_zones_sync": AsyncMock(),
            "zones": {},
        },
        "schema": {"assert_schema_ready": AsyncMock()},
    }
    for name, attributes in boundaries.items():
        module = ModuleType(name)
        module.__dict__.update(attributes)
        monkeypatch.setitem(sys.modules, name, module)
    spec = importlib.util.spec_from_file_location(
        "_security_lifespan_test", Path(__file__).with_name("lifecycle.py")
    )
    assert spec is not None and spec.loader is not None
    lifecycle = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lifecycle)
    return lifecycle


@pytest.mark.parametrize("missing", [*FLAGS, "SECRET_KEY"])
def test_actual_lifespan_rejects_before_database_and_workers(
    monkeypatch, isolated_lifecycle, missing
):
    configure_secure(monkeypatch)
    monkeypatch.delenv(missing)
    with pytest.raises(RuntimeError, match="Production telemetry requires"):
        with TestClient(FastAPI(lifespan=isolated_lifecycle.lifespan)):
            pytest.fail("Unsafe production startup must not succeed")
    isolated_lifecycle.get_pool.assert_not_called()
    isolated_lifecycle.traccar_redis_bridge.assert_not_called()
    isolated_lifecycle.privacy_zones_sync.assert_not_called()
    isolated_lifecycle.start_drain_worker.assert_not_called()


def test_valid_security_reaches_normal_database_initialization(monkeypatch, isolated_lifecycle):
    configure_secure(monkeypatch)
    with pytest.raises(RuntimeError, match="test-database-boundary"):
        with TestClient(FastAPI(lifespan=isolated_lifecycle.lifespan)):
            pytest.fail("Test database boundary should stop this isolated startup")
    isolated_lifecycle.get_pool.assert_awaited_once()
