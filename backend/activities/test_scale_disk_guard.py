"""Tests for automatic Postgres disk guard."""

from unittest.mock import patch

from django.test import SimpleTestCase

from activities.scale_config import compute_batch_scaling
from activities.scale_disk_guard import (
    _should_auto_wipe,
    adjust_batch_plan_for_disk_pressure,
    infer_volume_cap_from_db_usage,
    is_disk_full_error,
    prepare_batch_disk_guard,
    resolve_disk_budget_gb,
)


class ScaleDiskGuardTest(SimpleTestCase):
    def test_infer_volume_cap_railway_tiers(self):
        self.assertEqual(infer_volume_cap_from_db_usage(4.99), 5)
        self.assertEqual(infer_volume_cap_from_db_usage(0.2), 0.5)
        self.assertEqual(infer_volume_cap_from_db_usage(8.0), 10)

    @patch.dict("os.environ", {"SCALE_POSTGRES_DISK_BUDGET_GB": ""}, clear=False)
    @patch("activities.scale_disk_guard.get_database_size_gb", return_value=4.2)
    def test_resolve_infers_from_db_size(self, _db):
        budget, source = resolve_disk_budget_gb(4.2)
        self.assertEqual(budget, 5)
        self.assertEqual(source, "inferred_pg_size")

    @patch.dict("os.environ", {"SCALE_POSTGRES_DISK_BUDGET_GB": ""}, clear=False)
    def test_resolve_empty_db_uses_floor_not_half_gb_tier(self):
        budget, source = resolve_disk_budget_gb(0.1, batch_delta_gb=6.7)
        self.assertEqual(source, "empty_db_floor")
        self.assertEqual(budget, 5.0)

    @patch.dict("os.environ", {"SCALE_POSTGRES_DISK_BUDGET_GB": "20"}, clear=False)
    def test_resolve_empty_db_uses_env_when_set(self):
        budget, source = resolve_disk_budget_gb(0.1)
        self.assertEqual(source, "env")
        self.assertEqual(budget, 20.0)

    @patch("activities.scale_disk_guard.get_user_model")
    @patch("activities.scale_disk_guard._should_auto_wipe", return_value=(False, ""))
    @patch("activities.scale_disk_guard.get_database_size_gb", return_value=0.1)
    def test_prepare_ok_after_wipe_small_db_large_batch(self, _db, _wipe, mock_user):
        mock_user.objects.filter.return_value.count.return_value = 0
        result = prepare_batch_disk_guard(200_000, skip_activities=True)
        self.assertTrue(result["ok"], result.get("error"))

    @patch.dict("os.environ", {"SCALE_POSTGRES_DISK_BUDGET_GB": "25"})
    def test_resolve_env_override(self):
        budget, source = resolve_disk_budget_gb(4.0)
        self.assertEqual(budget, 25)
        self.assertEqual(source, "env")

    def test_is_disk_full_error(self):
        self.assertTrue(is_disk_full_error(Exception('could not extend file "base/16384/24646"')))
        self.assertFalse(is_disk_full_error(Exception("duplicate key")))

    def test_adjust_plan_high_pressure(self):
        plan = compute_batch_scaling(300_000)
        out = adjust_batch_plan_for_disk_pressure(plan, usage_ratio=1.05)
        self.assertLessEqual(out["user_bulk_pg_batch_size"], plan["user_bulk_pg_batch_size"])
        self.assertLessEqual(out["max_parallel_workers"], plan["max_parallel_workers"])

    @patch("activities.scale_disk_guard.get_database_size_gb", return_value=8.0)
    @patch("activities.scale_disk_guard.get_user_model")
    def test_auto_wipe_grow_without_wipe(self, mock_user, _db):
        mock_user.objects.filter.return_value.count.return_value = 50_000
        do, reason = _should_auto_wipe(
            100_000,
            50_000,
            skip_activities=True,
            db_gb=8.0,
            clear=False,
        )
        self.assertFalse(do)
        self.assertEqual(reason, "")

    @patch("activities.scale_disk_guard.get_database_size_gb", return_value=8.0)
    @patch("activities.scale_disk_guard.get_user_model")
    def test_auto_wipe_reseed_at_capacity(self, mock_user, _db):
        mock_user.objects.filter.return_value.count.return_value = 100_000
        do, reason = _should_auto_wipe(
            100_000,
            100_000,
            skip_activities=True,
            db_gb=8.0,
            clear=False,
        )
        self.assertTrue(do)
        self.assertIn("re-seed", reason)

    @patch("activities.scale_disk_guard.wait_for_wipe_completed", return_value=True)
    @patch("activities.wipe_tasks.run_wipe_sync", return_value={"status": "complete"})
    @patch("activities.wipe_state.get_wipe_state", return_value={"running": False})
    @patch("activities.scale_disk_guard.get_database_size_gb", return_value=0.5)
    @patch("activities.scale_disk_guard.get_user_model")
    def test_prepare_runs_wipe_and_ok(self, mock_user, _db, _ws, _wipe, _wait):
        mock_user.objects.filter.return_value.count.side_effect = [50_000, 0]
        with patch("activities.scale_disk_guard._should_auto_wipe", return_value=(True, "test")):
            result = prepare_batch_disk_guard(100_000, skip_activities=True)
        self.assertTrue(result["ok"])
        self.assertTrue(any("wipe" in a.lower() for a in result["actions"]))
