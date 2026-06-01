"""Wipe status helpers — prevents false 'complete' when idle before task starts."""
from django.test import SimpleTestCase

from activities import wipe_state as ws


class WipeStatusLabelTests(SimpleTestCase):
    def test_idle_is_not_complete(self):
        state = {'running': False, 'phase': 'idle', 'error': None}
        self.assertEqual(ws.wipe_status_label(state), 'idle')

    def test_queued_while_running(self):
        state = {'running': True, 'phase': 'queued', 'error': None}
        self.assertEqual(ws.wipe_status_label(state), 'queued')

    def test_complete(self):
        state = {'running': False, 'phase': 'complete', 'error': None}
        self.assertEqual(ws.wipe_status_label(state), 'complete')

    def test_complete_with_vacuum_warning_not_error(self):
        state = {
            'running': False,
            'phase': 'complete',
            'error': None,
            'warning': 'permission denied for VACUUM',
        }
        self.assertEqual(ws.wipe_status_label(state), 'complete')

    def test_error_with_message(self):
        state = {'running': False, 'phase': 'error', 'error': 'disk full'}
        self.assertEqual(ws.wipe_status_label(state), 'error')

    def test_stuck_queued(self):
        import time as _time
        state = {
            'running': True,
            'phase': 'queued',
            'started_at': _time.time() - 300,
        }
        self.assertTrue(ws.is_wipe_stuck(state))

    def test_not_stuck_when_idle(self):
        state = {'running': False, 'phase': 'idle'}
        self.assertFalse(ws.is_wipe_stuck(state))
