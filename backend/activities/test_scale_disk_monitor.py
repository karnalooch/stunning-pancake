"""Tests for proactive disk monitor and audit."""
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase

from activities.scale_disk_monitor import (
    EVENT_BLOCK_WRITES,
    EVENT_OK,
    EVENT_PAUSE_SIM,
    EVENT_WARN,
    REDIS_KEY_DISK_WRITES_BLOCKED,
    REDIS_KEY_SIMULATION_PAUSED,
    _evaluate_action,
    check_simulation_allowed,
    check_sim_writes_allowed,
    get_disk_usage_snapshot,
    run_disk_monitor,
)
from activities.scale_config import (
    DISK_BLOCK_WRITES_PCT,
    DISK_PAUSE_SIM_PCT,
    DISK_WARN_PCT,
)


class EvaluateThresholdsTest(SimpleTestCase):
    def test_warn_threshold(self):
        event, action, pause, block = _evaluate_action(DISK_WARN_PCT + 0.01)
        self.assertEqual(event, EVENT_WARN)
        self.assertFalse(pause)
        self.assertFalse(block)

    def test_pause_threshold(self):
        event, action, pause, block = _evaluate_action(DISK_PAUSE_SIM_PCT + 0.01)
        self.assertEqual(event, EVENT_PAUSE_SIM)
        self.assertTrue(pause)
        self.assertFalse(block)

    def test_block_threshold(self):
        event, action, pause, block = _evaluate_action(DISK_BLOCK_WRITES_PCT + 0.01)
        self.assertEqual(event, EVENT_BLOCK_WRITES)
        self.assertTrue(pause)
        self.assertTrue(block)

    def test_ok_clears_flags(self):
        event, action, pause, block = _evaluate_action(0.5)
        self.assertEqual(event, EVENT_OK)
        self.assertFalse(pause)
        self.assertFalse(block)


class DiskMonitorRedisTest(SimpleTestCase):
    @patch('activities.scale_disk_monitor.record_disk_audit_event')
    @patch('activities.scale_disk_monitor._set_redis_bool')
    @patch('activities.scale_disk_monitor.is_simulation_paused', return_value=False)
    @patch('activities.scale_disk_monitor.are_sim_writes_blocked', return_value=False)
    @patch('activities.scale_disk_monitor.get_disk_usage_snapshot')
    def test_monitor_sets_pause_at_90(self, mock_snap, _wb, _ps, mock_set, _audit):
        mock_snap.return_value = {
            'available': True,
            'used_gb': 9.0,
            'budget_gb': 10.0,
            'pct': 0.9,
            'budget_source': 'env',
        }
        result = run_disk_monitor(source='cron')
        self.assertEqual(result['event_type'], EVENT_PAUSE_SIM)
        mock_set.assert_any_call(REDIS_KEY_SIMULATION_PAUSED, True)
        mock_set.assert_any_call(REDIS_KEY_DISK_WRITES_BLOCKED, False)

    @patch('activities.scale_disk_monitor.record_disk_audit_event')
    @patch('activities.scale_disk_monitor._set_redis_bool')
    @patch('activities.scale_disk_monitor.is_simulation_paused', return_value=True)
    @patch('activities.scale_disk_monitor.are_sim_writes_blocked', return_value=False)
    @patch('activities.scale_disk_monitor.get_disk_usage_snapshot')
    def test_monitor_clears_on_recovery(self, mock_snap, _wb, _ps, mock_set, mock_audit):
        mock_snap.return_value = {
            'available': True,
            'used_gb': 5.0,
            'budget_gb': 10.0,
            'pct': 0.5,
            'budget_source': 'env',
        }
        run_disk_monitor(source='cron')
        mock_set.assert_any_call(REDIS_KEY_SIMULATION_PAUSED, False)
        mock_audit.assert_called()


class GuardChecksTest(SimpleTestCase):
    @patch('activities.scale_disk_monitor.AUTO_DISK_GUARD', True)
    @patch('activities.scale_disk_monitor.is_simulation_paused', return_value=True)
    def test_paused_redis_blocks(self, _p):
        ok, reason = check_simulation_allowed('simulator')
        self.assertFalse(ok)
        self.assertIn('paused', reason.lower())

    @patch('activities.scale_disk_monitor.AUTO_DISK_GUARD', True)
    @patch('activities.scale_disk_monitor.is_simulation_paused', return_value=False)
    @patch('activities.scale_disk_monitor.are_sim_writes_blocked', return_value=True)
    @patch('activities.scale_disk_monitor.get_disk_usage_snapshot')
    def test_writes_blocked(self, mock_snap, _p, _b):
        mock_snap.return_value = {'available': True, 'pct': 0.5}
        ok, reason = check_sim_writes_allowed('simulator')
        self.assertFalse(ok)


class DiskAuditModelTest(TestCase):
    @patch('activities.scale_disk_monitor.get_database_size_gb', return_value=4.0)
    @patch('activities.scale_disk_guard.resolve_disk_budget_gb', return_value=(10.0, 'env'))
    def test_snapshot_pct(self, _b, _db):
        snap = get_disk_usage_snapshot()
        self.assertTrue(snap['available'])
        self.assertAlmostEqual(snap['pct'], 0.4)

    @patch('activities.scale_disk_monitor.record_disk_audit_event')
    @patch('activities.scale_disk_monitor._set_redis_bool')
    @patch('activities.scale_disk_monitor._redis')
    @patch('activities.scale_disk_monitor.is_simulation_paused', return_value=False)
    @patch('activities.scale_disk_monitor.are_sim_writes_blocked', return_value=False)
    @patch('activities.scale_disk_monitor.get_disk_usage_snapshot')
    def test_audit_persisted_on_warn(self, mock_snap, _r, mock_set, mock_audit):
        from activities.models import DiskAuditEvent

        mock_snap.return_value = {
            'available': True,
            'used_gb': 8.5,
            'budget_gb': 10.0,
            'pct': 0.85,
            'budget_source': 'env',
        }

        def record(event_type, **kwargs):
            DiskAuditEvent.objects.create(
                event_type=event_type,
                used_gb=kwargs.get('used_gb'),
                budget_gb=kwargs.get('budget_gb'),
                pct=kwargs.get('pct'),
                action_taken=kwargs.get('action_taken', ''),
                source=kwargs.get('source', 'cron'),
            )

        mock_audit.side_effect = record
        run_disk_monitor(source='cron')
        self.assertGreaterEqual(DiskAuditEvent.objects.count(), 1)
