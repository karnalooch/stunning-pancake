"""Pytest hooks — block accidental hgetall on dev Redis after load sim."""

from __future__ import annotations

import os

import pytest

# Ephemeral DB before Django/settings read REDIS_URL (pytest loads conftest early).
if os.environ.get("PYTEST_ALLOW_SHARED_REDIS") != "1":
    os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/15")


def _redis_url_looks_shared() -> bool:
    url = (os.environ.get("REDIS_URL") or "").strip()
    if not url:
        return True
    return url.rstrip("/").endswith("/0") or "redis:6379/0" in url


@pytest.fixture(autouse=True)
def _simulator_light_blocks_real_redis(request):
    """simulator_light must never touch the laptop's live-rides hash."""
    if request.node.get_closest_marker("simulator_light") is None:
        return
    from core.fake_redis import install_pytest_redis

    install_pytest_redis()


def pytest_collection_modifyitems(config, items):
    if os.environ.get("PYTEST_ALLOW_SHARED_REDIS") == "1":
        return
    if not _redis_url_looks_shared():
        return
    skip = pytest.mark.skip(
        reason=(
            "simulator_integration requires PYTEST_ALLOW_SHARED_REDIS=1 or "
            "REDIS_URL not on db/0 (shared dev Redis)"
        )
    )
    for item in items:
        if item.get_closest_marker("simulator_integration"):
            item.add_marker(skip)
