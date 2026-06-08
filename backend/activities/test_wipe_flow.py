from unittest.mock import patch

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from activities.test_wipe_state import _FakeRedis
from activities.wipe_tasks import run_wipe_sync

User = get_user_model()


@pytest.fixture
def owner_user(db):
    return User.objects.create_user(
        username="owner_wipe",
        email="owner_wipe@test.com",
        password="pass",
        role="GLOBAL_OWNER",
    )


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
def test_wipe_get_returns_progress_fields(api_client, owner_user):
    api_client.force_authenticate(user=owner_user)
    url = reverse("admin-wipe-data")
    with (
        patch(
            "activities.wipe_state.get_wipe_state",
            return_value={
                "running": True,
                "phase": "users",
                "progress_pct": 61,
                "error": None,
                "deleted": {"users": 12000},
                "tables_done": 4,
                "tables_total": 7,
                "rows_deleted": 12000,
                "message": "Deleting users",
            },
        ),
        patch("activities.wipe_state.is_wipe_stuck", return_value=False),
        patch("activities.wipe_state.get_wipe_log", return_value=[]),
    ):
        response = api_client.get(url)

    assert response.status_code == 200
    assert response.data["status"] == "running"
    assert response.data["tables_done"] == 4
    assert response.data["tables_total"] == 7
    assert response.data["rows_deleted"] == 12000
    assert response.data["phase_label"]
    assert response.data["error"] is None


@pytest.mark.django_db
def test_wipe_delete_is_idempotent_when_already_running(api_client, owner_user):
    api_client.force_authenticate(user=owner_user)
    url = reverse("admin-wipe-data")
    env = "DEVELOPMENT" if settings.DEBUG else "PRODUCTION"
    payload = {
        "confirm": True,
        "confirm_phrase": f"DELETE ALL DATA — {env} — GLOBAL_OWNER",
        "mfa_confirmed": True,
    }

    with (
        patch(
            "activities.wipe_state.get_wipe_state",
            return_value={
                "running": True,
                "phase": "users",
                "progress_pct": 61,
                "error": None,
                "deleted": {"users": 12000},
            },
        ),
        patch("activities.wipe_state.is_wipe_stuck", return_value=False),
        patch("activities.wipe_tasks.start_wipe_async") as start_async,
    ):
        response = api_client.delete(url, payload, format="json")

    assert response.status_code == 202
    assert response.data["running"] is True
    assert response.data["status"] in ("running", "queued")
    assert "already running" in response.data["message"].lower()
    start_async.assert_not_called()


@pytest.mark.django_db
def test_batch_start_rejected_while_wipe_in_progress(api_client, owner_user):
    api_client.force_authenticate(user=owner_user)
    url = reverse("admin-simulate")
    with patch("activities.wipe_state.is_wipe_in_progress", return_value=True):
        response = api_client.post(url, {"total_users": 1000}, format="json")
    assert response.status_code == 409
    assert response.data["code"] == "WIPE_IN_PROGRESS"


@pytest.mark.django_db
def test_live_start_rejected_while_wipe_in_progress(api_client, owner_user):
    api_client.force_authenticate(user=owner_user)
    url = reverse("admin-live-simulate")
    payload = {"pool_pct": 1.0, "active_ratio": 0.2, "cheat_ratio": 0.05, "tick_seconds": 8}
    with patch("activities.wipe_state.is_wipe_in_progress", return_value=True):
        response = api_client.post(url, payload, format="json")
    assert response.status_code == 409
    assert response.data["code"] == "WIPE_IN_PROGRESS"


def test_run_wipe_sync_lock_conflict_does_not_override_running_state():
    with (
        patch("activities.wipe_tasks.ws.acquire_wipe_lock", return_value=False),
        patch("activities.wipe_tasks.ws.get_wipe_state", return_value={"running": True}),
        patch("activities.wipe_tasks.ws.set_wipe_state") as set_state,
    ):
        result = run_wipe_sync()

    assert result["status"] == "already_running"
    set_state.assert_not_called()


@pytest.mark.django_db
def test_wipe_post_unstick_clears_running_state(api_client, owner_user):
    api_client.force_authenticate(user=owner_user)
    url = reverse("admin-wipe-data")
    with (
        patch(
            "activities.wipe_state.get_wipe_state", return_value={"running": True, "phase": "users"}
        ),
        patch("activities.wipe_state.is_wipe_in_progress", return_value=True),
        patch("activities.wipe_state.force_reset_wipe") as force_reset,
        patch("activities.wipe_state.get_wipe_log", return_value=[]),
        patch(
            "activities.wipe_state.serialize_wipe_response",
            side_effect=lambda state, **kw: {**state, "status": "idle", "stuck": False},
        ),
    ):
        response = api_client.post(url, {"action": "unstick"}, format="json")

    assert response.status_code == 200
    force_reset.assert_called_once()


@pytest.mark.django_db
def test_wipe_post_unstick_idle_when_nothing_running(api_client, owner_user):
    api_client.force_authenticate(user=owner_user)
    url = reverse("admin-wipe-data")
    with (
        patch(
            "activities.wipe_state.get_wipe_state", return_value={"running": False, "phase": "idle"}
        ),
        patch("activities.wipe_state.is_wipe_in_progress", return_value=False),
        patch("activities.wipe_state.force_reset_wipe") as force_reset,
        patch(
            "activities.wipe_state.serialize_wipe_response",
            side_effect=lambda state, **kw: {**state, "status": "idle", "stuck": False},
        ),
    ):
        response = api_client.post(url, {"action": "unstick"}, format="json")

    assert response.status_code == 200
    force_reset.assert_not_called()


@pytest.mark.django_db
def test_wipe_deletes_users_with_audit_log_references(owner_user):
    from users.models import AuditLog, Tenant

    athlete = User.objects.create_user(
        username="athlete_wipe_fk",
        email="athlete_wipe_fk@test.com",
        password="pass",
        role="ATHLETE",
    )
    AuditLog.objects.create(
        impersonator=owner_user,
        target_user=athlete,
        action="impersonated athlete",
    )
    Tenant.objects.create(id="wipe-fk-city", name="Wipe FK City", is_active=True)

    class _WipeRunRedis(_FakeRedis):
        def __init__(self):
            super().__init__()
            self._lists = {}

        def set(self, key, value, nx=False, ex=None):
            return True

        def exists(self, key):
            return False

        def rpush(self, key, *values):
            self._lists.setdefault(key, []).extend(values)

        def ltrim(self, key, start, end):
            pass

        def lrange(self, key, start, end):
            return self._lists.get(key, [])

    fake_redis = _WipeRunRedis()

    with (
        patch("activities.wipe_state.get_redis", return_value=fake_redis),
        patch("activities.simulator_state.force_stop_live_simulation"),
        patch("activities.simulator_state.force_stop_batch_simulation"),
        patch("activities.simulator_state.reset_batch_state"),
        patch("activities.simulator_state.reset_live_state"),
        patch("activities.services.TelemetryService.clear_simulator_positions"),
        patch("activities.admin_stats.invalidate_dashboard_stats_cache"),
        patch("activities.wipe_tasks._vacuum_postgres_if_needed", return_value=None),
        patch("activities.wipe_tasks._clear_disk_guard_after_wipe"),
    ):
        result = run_wipe_sync()

    assert result["status"] == "complete"
    assert not User.objects.filter(pk=athlete.pk).exists()
    assert AuditLog.objects.count() == 0
    assert Tenant.objects.count() == 0
    assert User.objects.filter(role="GLOBAL_OWNER").exists()
