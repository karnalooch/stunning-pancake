"""Small repository contract checks for the T73 pilot wiring."""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class T73PilotWiringTests(unittest.TestCase):
    def test_backend_entrypoint_checks_migrations_without_privileged_url(self):
        content = (ROOT / "backend" / "docker-entrypoint.sh").read_text(encoding="utf-8")
        self.assertNotIn("MIGRATION_DATABASE_URL", content)
        self.assertIn("python manage.py migrate --check --no-input", content)
        self.assertNotIn("python manage.py migrate --no-input", content)
        self.assertIn("python manage.py check --deploy", content)

    def test_home_lab_declares_non_bypass_runtime_role(self):
        content = (ROOT / "docker-compose.home.yml").read_text(encoding="utf-8")
        self.assertIn("NOSUPERUSER NOBYPASSRLS", content)
        self.assertIn("APP_DB_USER", content)
        self.assertIn("RLS_RUNTIME_ROLE_GUARD", content)
        self.assertIn("backend_migrate:", content)
        self.assertNotIn("MIGRATION_DATABASE_URL", content)

    def test_k8s_privileged_migration_secret_is_not_mounted_by_runtime_workloads(self):
        migration_job_path = ROOT / "infrastructure" / "k8s" / "jobs" / "migrate-job.yaml"
        job = migration_job_path.read_text(encoding="utf-8")
        self.assertIn("sport-migration-secrets", job)
        self.assertIn("MIGRATION_DATABASE_URL", job)

        for filename in (
            "api.yaml",
            "worker.yaml",
            "worker-simulation.yaml",
            "beat.yaml",
        ):
            runtime_path = ROOT / "infrastructure" / "k8s" / "workloads" / filename
            runtime = runtime_path.read_text(encoding="utf-8")
            with self.subTest(filename=filename):
                self.assertNotIn("sport-migration-secrets", runtime)
                self.assertNotIn("MIGRATION_DATABASE_URL", runtime)
