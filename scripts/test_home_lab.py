import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import home_lab
from backup_crypto import decode_key


class HomeLabTests(unittest.TestCase):
    def test_compose_command_is_pinned_to_local_project_env_and_layered_files(self):
        command = home_lab.compose_command("config", "--quiet", profiles=("routing", "simulation"))
        self.assertEqual(
            command[:6],
            ["docker", "compose", "-p", "4velo-home", "--env-file", str(home_lab.ENV_FILE)],
        )
        base_pair = ["-f", str(home_lab.BASE_COMPOSE_FILE)]
        home_pair = ["-f", str(home_lab.HOME_COMPOSE_FILE)]
        self.assertEqual(command[6:10], [*base_pair, *home_pair])
        self.assertEqual(
            command[-6:], ["--profile", "routing", "--profile", "simulation", "config", "--quiet"]
        )

    def test_render_environment_replaces_all_secret_placeholders(self):
        rendered = home_lab.render_environment(home_lab.ENV_TEMPLATE.read_text())
        self.assertNotIn("GENERATE_WITH_HOME_LAB_INIT", rendered)
        self.assertIn("TELEMETRY_INGEST_JWT_REQUIRED=1", rendered)
        self.assertIn("TELEMETRY_INGEST_AUDIENCE_REQUIRED=1", rendered)
        self.assertIn("TELEMETRY_INGEST_QUEUE=0", rendered)
        self.assertIn("APP_DB_USER=4velo_runtime", rendered)
        self.assertIn("RLS_RUNTIME_ROLE_GUARD=1", rendered)
        values = dict(
            line.split("=", 1)
            for line in rendered.splitlines()
            if line and not line.startswith("#")
        )
        self.assertGreaterEqual(len(values["SECRET_KEY"]), 64)
        self.assertNotEqual(values["SECRET_KEY"], values["TELEMETRY_INGEST_JWT_SECRET"])
        self.assertEqual(len(decode_key(values["BACKUP_ENCRYPTION_KEY"])), 32)
        self.assertNotEqual(values["BACKUP_ENCRYPTION_KEY"], values["SECRET_KEY"])
        self.assertNotEqual(
            values["BACKUP_ENCRYPTION_KEY"], values["TELEMETRY_INGEST_JWT_SECRET"]
        )

    def test_home_override_enforces_pilot_ack_shared_signing_key_and_runtime_db_role(self):
        content = home_lab.HOME_COMPOSE_FILE.read_text(encoding="utf-8")
        self.assertIn('TELEMETRY_INGEST_QUEUE: "0"', content)
        self.assertIn('TELEMETRY_INGEST_AUDIENCE_REQUIRED: "1"', content)
        self.assertIn('TELEMETRY_INGEST_JWT_REQUIRED: "1"', content)
        self.assertIn(
            "TELEMETRY_INGEST_JWT_SECRET: ${TELEMETRY_INGEST_JWT_SECRET:?err_TELEMETRY_INGEST_JWT_SECRET_not_set}",
            content,
        )
        self.assertIn("db_runtime_role_init:", content)
        self.assertIn("NOSUPERUSER NOBYPASSRLS", content)
        self.assertIn('RLS_RUNTIME_ROLE_GUARD: "1"', content)
        self.assertIn("MIGRATION_DATABASE_URL:", content)
        self.assertIn("APP_DB_USER:-4velo_runtime", content)

    def test_pilot_core_ports_replace_base_bindings_with_loopback_only(self):
        content = home_lab.HOME_COMPOSE_FILE.read_text(encoding="utf-8")
        self.assertEqual(content.count("ports: !override"), 5)
        for port in (5432, 6379, 8000, 8001, 3001):
            self.assertIn(f'127.0.0.1:{port}:', content)

    def test_production_django_transport_hardening_is_fail_closed(self):
        settings = (home_lab.ROOT / "backend" / "core" / "settings.py").read_text(encoding="utf-8")
        self.assertIn('SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")', settings)
        self.assertIn("SECURE_SSL_REDIRECT = not DEBUG", settings)
        self.assertIn("SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG", settings)
        self.assertIn("SESSION_COOKIE_SECURE = not DEBUG", settings)
        self.assertIn("CSRF_COOKIE_SECURE = not DEBUG", settings)

    def test_initialize_creates_private_environment_file(self):
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / ".env.home"
            with patch.object(home_lab, "ENV_FILE", env):
                home_lab.initialize()

            self.assertTrue(env.is_file())
            if os.name == "posix":
                self.assertEqual(env.stat().st_mode & 0o777, 0o600)

    def test_initialize_refuses_to_overwrite_environment(self):
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / ".env.home"
            env.write_text("existing")
            with patch.object(home_lab, "ENV_FILE", env), self.assertRaises(SystemExit):
                home_lab.initialize()
            self.assertEqual(env.read_text(), "existing")

    def test_validate_backup_accepts_encrypted_artifact_only(self):
        with tempfile.TemporaryDirectory() as folder:
            folder_path = Path(folder)
            with self.assertRaises(SystemExit):
                home_lab.validate_backup(folder_path / "missing.dump.enc")

            plaintext = folder_path / "backup.dump"
            plaintext.write_bytes(b"plaintext")
            with self.assertRaises(SystemExit):
                home_lab.validate_backup(plaintext)

            encrypted = folder_path / "backup.dump.enc"
            encrypted.write_bytes(b"encrypted")
            self.assertEqual(home_lab.validate_backup(encrypted), encrypted.resolve())

    def test_prune_backups_enforces_thirty_day_policy_for_canonical_artifacts(self):
        with tempfile.TemporaryDirectory() as folder:
            backup_dir = Path(folder)
            old = backup_dir / "4velo-home-old.dump.enc"
            recent = backup_dir / "4velo-home-recent.dump.enc"
            unrelated = backup_dir / "manual.dump.enc"
            for path in (old, recent, unrelated):
                path.write_bytes(b"encrypted")
            old_epoch = time.time() - 31 * 24 * 60 * 60
            os.utime(old, (old_epoch, old_epoch))

            with patch.object(home_lab, "BACKUP_DIR", backup_dir):
                removed = home_lab.prune_backups()

            self.assertEqual(removed, [old])
            self.assertFalse(old.exists())
            self.assertTrue(recent.exists())
            self.assertTrue(unrelated.exists())

    def test_parse_compose_ps_accepts_json_array(self):
        output = '[{"Service":"db","State":"running"},{"Service":"redis","State":"running"}]'
        self.assertEqual(
            [row["Service"] for row in home_lab.parse_compose_ps(output)], ["db", "redis"]
        )

    def test_parse_compose_ps_accepts_json_lines(self):
        output = '{"Service":"db","State":"running"}\n{"Service":"redis","State":"running"}'
        self.assertEqual(
            [row["Service"] for row in home_lab.parse_compose_ps(output)], ["db", "redis"]
        )

    @staticmethod
    def _valid_recovery_snapshot():
        return {
            "tenants": [{"id": "a"}, {"id": "b"}],
            "users": [
                {"role": "TENANT_ADMIN"},
                {"role": "ATHLETE"},
                {"role": "TENANT_ADMIN"},
                {"role": "ATHLETE"},
            ],
            "departments": [{"name": "a"}, {"name": "b"}],
            "memberships": [{}, {}, {}, {}],
            "activities": [
                {"route_path": "SRID=4326;LINESTRING(1 1,2 2)", "route_fingerprint": "a" * 64},
                {"route_path": "SRID=4326;LINESTRING(3 3,4 4)", "route_fingerprint": "b" * 64},
            ],
            "audit_logs": [{}, {}],
            "gps_points": [
                {"external_id": "P3-RECOVERY-A", "seq": 1},
                {"external_id": "P3-RECOVERY-A", "seq": 2},
                {"external_id": "P3-RECOVERY-A", "seq": 3},
                {"external_id": "P3-RECOVERY-B", "seq": 1},
                {"external_id": "P3-RECOVERY-B", "seq": 2},
                {"external_id": "P3-RECOVERY-B", "seq": 3},
            ],
            "telemetry_receipts": [
                {
                    "point_count": 3,
                    "persisted_count": 3,
                    "dropped_privacy": 0,
                    "max_seq": 3,
                    "payload_fingerprint": "c" * 64,
                },
                {
                    "point_count": 3,
                    "persisted_count": 3,
                    "dropped_privacy": 0,
                    "max_seq": 3,
                    "payload_fingerprint": "d" * 64,
                },
            ],
            "newest_gps_epoch": 1_800_000_000.0,
        }

    def test_validate_recovery_snapshot_accepts_complete_fixture(self):
        snapshot = self._valid_recovery_snapshot()
        self.assertEqual(
            home_lab.validate_recovery_snapshot(snapshot),
            home_lab.P3_RECOVERY_EXPECTED_COUNTS,
        )

    def test_validate_recovery_snapshot_fails_closed_on_missing_business_data(self):
        snapshot = self._valid_recovery_snapshot()
        snapshot["gps_points"] = snapshot["gps_points"][:-1]
        with self.assertRaises(SystemExit):
            home_lab.validate_recovery_snapshot(snapshot)

    def test_validate_recovery_snapshot_fails_closed_on_sequence_gap(self):
        snapshot = self._valid_recovery_snapshot()
        snapshot["gps_points"][2]["seq"] = 4
        with self.assertRaises(SystemExit):
            home_lab.validate_recovery_snapshot(snapshot)

    def test_canonical_snapshot_digest_is_key_order_independent(self):
        left = {"a": 1, "b": {"c": 2}}
        right = {"b": {"c": 2}, "a": 1}
        self.assertEqual(
            home_lab.canonical_snapshot_digest(left),
            home_lab.canonical_snapshot_digest(right),
        )

    def test_home_env_value_reads_requested_setting_only(self):
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / ".env.home"
            env.write_text("POSTGRES_DB=4velo_home\nSECRET_KEY=do-not-print\n", encoding="utf-8")
            with patch.object(home_lab, "ENV_FILE", env):
                self.assertEqual(home_lab.home_env_value("POSTGRES_DB"), "4velo_home")


if __name__ == "__main__":
    unittest.main()
