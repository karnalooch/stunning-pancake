"""GET status endpoints for batch/live simulator — corrupt log tolerance + backpressure fields.

Integration-light: patches avoid loading the full live-rides Redis hash (hgetall), which
can exhaust memory after a large load test. Run:

  cd backend && python -m pytest activities/test_simulator_status_views.py -v --tb=short
"""

import json
from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from activities import simulator_state as sim

_EMPTY_FSM = {
    "ride_warming": 0,
    "ride_routing": 0,
    "ride_pending_route": 0,
    "ride_routed": 0,
    "ride_active": 0,
    "ride_on_map": 0,
}


@pytest.fixture(autouse=True)
def _isolate_heavy_sim_reads(monkeypatch):
    """Prevent GET handlers from hgetall on a huge live-rides hash."""
    monkeypatch.setattr(sim, "get_live_rides", lambda: {})
    monkeypatch.setattr(sim, "heal_stale_live_simulation", lambda **kwargs: None)
    monkeypatch.setattr(sim, "maybe_advance_live_simulation", lambda: None)
    monkeypatch.setattr(
        "activities.ride_fsm.fsm_summary",
        lambda _rides: dict(_EMPTY_FSM),
    )
    monkeypatch.setattr(
        "activities.simulator_routing_backpressure.get_broker_routing_queue_depth",
        lambda: None,
    )


@pytest.fixture
def owner_client(db):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    owner = User.objects.create_user(
        username="simstatus_owner",
        email="simstatus@test.com",
        password="pass",
        role="GLOBAL_OWNER",
    )
    client = APIClient()
    client.force_authenticate(user=owner)
    return client


@pytest.mark.django_db
def test_batch_status_get_tolerates_corrupt_log(owner_client):
    sim.reset_batch_state()
    sim.set_batch_state(
        running=False, current_phase="idle", total_users=10, progress_pct="not-a-float"
    )
    from core.redis_cluster import get_redis

    r = get_redis()
    r.delete(sim.BATCH_LOG_KEY)
    r.rpush(sim.BATCH_LOG_KEY, "not-json")
    r.rpush(sim.BATCH_LOG_KEY, json.dumps(["12:00:00", "ok"]))

    response = owner_client.get(reverse("admin-simulate"))
    assert response.status_code == 200
    assert response.data["running"] is False
    assert isinstance(response.data["log"], list)


@pytest.mark.django_db
def test_live_status_get_tolerates_corrupt_log(owner_client):
    sim.reset_live_state()
    sim.set_live_state(running=False, active_ratio="bad", cheat_ratio="")
    from core.redis_cluster import get_redis

    r = get_redis()
    r.delete(sim.LIVE_LOG_KEY)
    r.rpush(sim.LIVE_LOG_KEY, "{broken")
    r.rpush(sim.LIVE_LOG_KEY, json.dumps(["12:00:01", "tick"]))

    response = owner_client.get(reverse("admin-live-simulate"))
    assert response.status_code == 200
    assert response.data["running"] is False
    assert isinstance(response.data["log"], list)
    assert response.data["active_ratio"] == 0.0


@pytest.mark.django_db
def test_live_status_exposes_backpressure_fields(owner_client):
    sim.reset_live_state()
    sim.set_live_state(
        running=False,
        routing_queue_depth=42,
        routing_backpressure_active=True,
        dispatches_throttled=True,
    )
    from core.redis_cluster import get_redis

    r = get_redis()
    r.delete(sim.LIVE_LOG_KEY)
    r.rpush(sim.LIVE_LOG_KEY, json.dumps(["12:00:02", "backpressure"]))

    with patch(
        "activities.simulator_routing_backpressure.get_broker_routing_queue_depth",
        return_value=42,
    ):
        response = owner_client.get(reverse("admin-live-simulate"))

    assert response.status_code == 200
    assert response.data["routing_queue_depth"] == 42
    assert response.data["routing_backpressure_active"] is True
    assert response.data["dispatches_throttled"] is True
    assert response.data["routing_broker_queue_depth"] == 42
