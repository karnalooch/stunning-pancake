"""T73 Celery configuration contract tests."""

from django.test import SimpleTestCase

from core.celery import app
from core.task_rls import GLOBAL_OWNER_TASK_HEADER, RLSScopedTask


class CeleryRLSConfigurationTests(SimpleTestCase):
    def test_default_task_base_is_rls_scoped(self):
        self.assertTrue(issubclass(app.Task, RLSScopedTask))

    def test_cross_tenant_beat_jobs_have_explicit_global_owner_scope(self):
        expected = {
            "ml-model-retrain-weekly",
            "refresh-city-rankings-mv",
            "city-leaderboard-recalculate",
            "warm-dashboard-stats-cache",
            "postgres-disk-monitor",
            "live-map-alert-detector",
        }

        for name in expected:
            entry = app.conf.beat_schedule[name]
            headers = (entry.get("options") or {}).get("headers") or {}
            self.assertIs(headers.get(GLOBAL_OWNER_TASK_HEADER), True, name)

    def test_retention_job_does_not_get_implicit_global_owner_scope(self):
        entry = app.conf.beat_schedule["privacy-data-retention-daily"]
        headers = (entry.get("options") or {}).get("headers") or {}
        self.assertNotIn(GLOBAL_OWNER_TASK_HEADER, headers)
