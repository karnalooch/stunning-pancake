import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import home_lab


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

    def test_initialize_refuses_to_overwrite_environment(self):
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / ".env.home"
            env.write_text("existing")
            with patch.object(home_lab, "ENV_FILE", env), self.assertRaises(SystemExit):
                home_lab.initialize()
            self.assertEqual(env.read_text(), "existing")

    def test_validate_backup_rejects_missing_or_wrong_extension(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(SystemExit):
                home_lab.validate_backup(Path(folder) / "missing.dump")
            text = Path(folder) / "backup.txt"
            text.write_text("x")
            with self.assertRaises(SystemExit):
                home_lab.validate_backup(text)

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
