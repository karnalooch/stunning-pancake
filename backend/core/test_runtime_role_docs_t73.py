"""Small repository contract checks for the T73 pilot wiring."""

from pathlib import Path
from unittest import TestCase


ROOT = Path(__file__).resolve().parents[2]


class T73PilotWiringTests(TestCase):
    def test_backend_entrypoint_separates_migration_and_runtime_database_urls(self):
        content = (ROOT / "backend" / "docker-entrypoint.sh").read_text(encoding="utf-8")
        self.assertIn("MIGRATION_DATABASE_URL", content)
        self.assertIn("python manage.py check --deploy", content)

    def test_home_lab_declares_non_bypass_runtime_role(self):
        content = (ROOT / "docker-compose.home.yml").read_text(encoding="utf-8")
        self.assertIn("NOSUPERUSER NOBYPASSRLS", content)
        self.assertIn("APP_DB_USER", content)
        self.assertIn("RLS_RUNTIME_ROLE_GUARD", content)
