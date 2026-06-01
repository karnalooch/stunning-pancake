"""Tests for automatic Postgres disk guard."""
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from activities.scale_disk_guard import (
    adjust_batch_plan_for_disk_pressure,
    is_disk_full_error,
    prepare_batch_disk_guard,
    _should_auto_wipe,
)
from activities.scale_config import compute_batch_scaling


class ScaleDiskGuardTest(SimpleTestCase):
    def test_is_disk_full_error(self):
        self.assertTrue(is_disk_full_error(Exception('could not extend file "base/16384/24646"')))
        self.assertFalse(is_disk_full_error(Exception('duplicate key')))

    def test_adjust_plan_high_pressure(self):
        plan = compute_batch_scaling(300_000)
        out = adjust_batch_plan_for_disk_pressure(plan, usage_ratio=1.05)
        self.assertLessEqual(out['user_bulk_pg_batch_size'], plan['user_bulk_pg_batch_size'])
        self.assertLessEqual(out['max_parallel_workers'], plan['max_parallel_workers'])

    @patch('activities.scale_disk_guard.get_database_size_gb', return_value=8.0)
    @patch('activities.scale_disk_guard.get_user_model')
    def test_auto_wipe_reseed(self, mock_user, _db):
        mock_user.objects.filter.return_value.count.return_value = 50_000
        do, reason = _should_auto_wipe(
            100_000, 50_000, skip_activities=True, db_gb=8.0, clear=False,
        )
        self.assertTrue(do)
        self.assertIn('re-seed', reason)

    @patch('activities.scale_disk_guard.wait_for_wipe_completed', return_value=True)
    @patch('activities.wipe_tasks.run_wipe_sync', return_value={'status': 'complete'})
    @patch('activities.wipe_state.get_wipe_state', return_value={'running': False})
    @patch('activities.scale_disk_guard.get_database_size_gb', return_value=0.5)
    @patch('activities.scale_disk_guard.get_user_model')
    def test_prepare_runs_wipe_and_ok(self, mock_user, _db, _ws, _wipe, _wait):
        mock_user.objects.filter.return_value.count.side_effect = [50_000, 0]
        with patch('activities.scale_disk_guard._should_auto_wipe', return_value=(True, 'test')):
            result = prepare_batch_disk_guard(100_000, skip_activities=True)
        self.assertTrue(result['ok'])
        self.assertTrue(any('wipe' in a.lower() for a in result['actions']))
