"""GET status endpoints for batch/live simulator — corrupt log tolerance + backpressure fields.

Integration-light: patches avoid loading the full live-rides Redis hash (hgetall), which
can exhaust memory after a large load test. Run:

  cd backend && python run_pytest.py activities/test_simulator_status_views.py -m simulator_light -v
"""

import json
from unittest.mock import patch

import pytest

pytestmark = pytest.mark.simulator_light
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
    from core.fake_redis import install_pytest_redis

    fake = install_pytest_redis()
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
    return fake


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
    r = sim.get_redis()
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
    r = sim.get_redis()
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
    r = sim.get_redis()
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


@pytest.mark.django_db
@patch("activities.admin_views.run_batch_simulation.delay")
def test_batch_clear_stops_running_live(mock_delay, owner_client):
    sim.reset_live_state()
    sim.set_live_state(running=True, currently_riding=12)
    sim.acquire_live_lock()

    response = owner_client.post(
        reverse("admin-simulate"),
        {"clear": True, "total_users": 100, "skip_activities": True},
        format="json",
    )

    assert response.status_code == 200
    assert sim.get_live_state()["running"] is False
    assert sim.is_live_lock_held() is False
    mock_delay.assert_called_once()


@pytest.mark.django_db
def test_setup_live_athlete_pool_populates_redis(db):
    from django.contrib.auth import get_user_model

    from activities.simulator_live_start import setup_live_athlete_pool
    from simulate_active_cities import CITIES
    from users.models import Tenant

    User = get_user_model()
    city = CITIES[0]
    tenant, _ = Tenant.objects.get_or_create(name=city["name"])
    for i in range(20):
        User.objects.create_user(
            username=f"pool_athlete_{i:03d}",
            email=f"p{i}@test.com",
            password="x",
            role="ATHLETE",
            tenant=tenant,
        )

    sim.reset_live_state()
    pool_size = setup_live_athlete_pool(20)

    assert pool_size >= 10
    assert sim.get_live_pool_count() > 0 or sim.is_live_pool_db_mode()


@pytest.mark.django_db
@patch("activities.railway_osrm_lifecycle.scale_osrm_for_live_sim")
@patch("activities.sim_lab_proxy.assert_prod_heavy_sim_allowed", return_value=None)
@patch("activities.simulator_live_start.run_live_simulation")
def test_maybe_auto_start_live_after_batch(mock_live_task, _mock_prod, _mock_osrm, db):
    from django.contrib.auth import get_user_model

    from activities.simulator_live_start import maybe_auto_start_live_after_batch

    User = get_user_model()
    for i in range(15):
        User.objects.create_user(
            username=f"auto_live_{i:03d}",
            email=f"a{i}@test.com",
            password="x",
            role="ATHLETE",
        )

    sim.reset_batch_state()
    sim.reset_live_state()
    sim.set_batch_state(
        auto_start_live="true",
        auto_start_live_params=json.dumps(
            {"pool_pct": 1.0, "intensity": 50, "load": 50},
            separators=(",", ":"),
        ),
        current_phase="complete",
        running=False,
    )

    result = maybe_auto_start_live_after_batch()

    assert result.get("started") is True
    assert result.get("ok") is True
    assert sim.get_live_state()["running"] is True
    mock_live_task.delay.assert_called_once()
