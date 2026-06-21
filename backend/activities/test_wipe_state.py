"""Wipe status helpers — prevents false 'complete' when idle before task starts."""

from unittest.mock import patch

from django.test import SimpleTestCase

from activities import wipe_state as ws


class _FakeRedis:
    def __init__(self):
        self.hashes = {}

    def hset(self, key, mapping=None, **kwargs):
        self.hashes.setdefault(key, {}).update(mapping or {})

    def hgetall(self, key):
        return dict(self.hashes.get(key, {}))

    def expire(self, key, ttl):
        pass

    def delete(self, *keys):
        for key in keys:
            self.hashes.pop(key, None)


class WipeStatusLabelTests(SimpleTestCase):
    def test_idle_is_not_complete(self):
        state = {"running": False, "phase": "idle", "error": None}
        self.assertEqual(ws.wipe_status_label(state), "idle")

    def test_queued_while_running(self):
        state = {"running": True, "phase": "queued", "error": None}
        self.assertEqual(ws.wipe_status_label(state), "queued")

    def test_complete(self):
        state = {"running": False, "phase": "complete", "error": None}
        self.assertEqual(ws.wipe_status_label(state), "complete")

    def test_complete_with_vacuum_warning_not_error(self):
        state = {
            "running": False,
            "phase": "complete",
            "error": None,
            "warning": "permission denied for VACUUM",
        }
        self.assertEqual(ws.wipe_status_label(state), "complete")

    def test_error_with_message(self):
        state = {"running": False, "phase": "error", "error": "disk full"}
        self.assertEqual(ws.wipe_status_label(state), "error")

    def test_stuck_queued(self):
        import time as _time

        state = {
            "running": True,
            "phase": "queued",
            "started_at": _time.time() - 300,
        }
        self.assertTrue(ws.is_wipe_stuck(state))

    def test_not_stuck_when_idle(self):
        state = {"running": False, "phase": "idle"}
        self.assertFalse(ws.is_wipe_stuck(state))

    def test_users_phase_recent_progress_not_stuck(self):
        import time as _time

        state = {
            "running": True,
            "phase": "users",
            "started_at": _time.time() - 600,
            "last_progress_at": _time.time() - 30,
        }
        self.assertFalse(ws.is_wipe_stuck(state))

    def test_users_phase_stale_progress_stuck(self):
        import time as _time

        state = {
            "running": True,
            "phase": "users",
            "started_at": _time.time() - 600,
            "last_progress_at": _time.time() - 300,
        }
        self.assertTrue(ws.is_wipe_stuck(state))
        self.assertEqual(ws.wipe_stuck_reason(state), "no_progress")

    def test_running_without_last_progress_uses_running_threshold(self):
        import time as _time

        state = {
            "running": True,
            "phase": "activities",
            "started_at": _time.time() - 500,
        }
        self.assertFalse(ws.is_wipe_stuck(state))
        state["started_at"] = _time.time() - 1000
        self.assertTrue(ws.is_wipe_stuck(state))

    @patch("activities.wipe_state.get_redis")
    def test_none_error_not_serialized_as_string(self, mock_get_redis):
        mock_get_redis.return_value = _FakeRedis()
        ws.set_wipe_state(running=True, phase="users", progress_pct=50, error=None)
        state = ws.get_wipe_state()
        self.assertIsNone(state["error"])

    @patch("activities.wipe_state.get_redis")
    def test_progress_fields_in_state(self, mock_get_redis):
        mock_get_redis.return_value = _FakeRedis()
        ws.set_wipe_state(
            running=True,
            phase="activities",
            progress_pct=12.5,
            deleted={"activities": 5000},
            tables_done=2,
            tables_total=7,
            message="Deleting activities",
        )
        state = ws.get_wipe_state()
        self.assertEqual(state["tables_done"], 2)
        self.assertEqual(state["tables_total"], 7)
        self.assertEqual(state["rows_deleted"], 5000)
        self.assertEqual(state["deleted"]["activities"], 5000)
        self.assertIsNotNone(state["last_progress_at"])

    @patch("activities.wipe_state.get_redis")
    def test_serialize_wipe_response_shape(self, mock_get_redis):
        mock_get_redis.return_value = _FakeRedis()
        state = ws.get_wipe_state()
        payload = ws.serialize_wipe_response(state, log=[])
        self.assertIn("status", payload)
        self.assertIn("phase_label", payload)
        self.assertIn("stuck", payload)
        self.assertIn("tables_total", payload)
        self.assertIn("last_progress_at", payload)

    def test_serialize_includes_stuck_reason_when_stuck(self):
        import time as _time

        state = {
            "running": True,
            "phase": "users",
            "started_at": _time.time() - 600,
            "last_progress_at": _time.time() - 300,
            "progress_pct": 60,
        }
        payload = ws.serialize_wipe_response(state)
        self.assertTrue(payload["stuck"])
        self.assertEqual(payload["stuck_reason"], "no_progress")
