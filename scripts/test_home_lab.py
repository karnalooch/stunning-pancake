import io
import json
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
        self.assertEqual(command.count("-f"), 2)
        self.assertNotIn(str(home_lab.ROOT / "docker-compose.override.yml"), command)
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
        self.assertGreaterEqual(len(values["ADMIN_PASSWORD"]), 20)
        self.assertNotEqual(values["ADMIN_PASSWORD"], values["DB_PASSWORD"])
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
        self.assertIn(
            "ADMIN_PASSWORD: ${ADMIN_PASSWORD:?err_ADMIN_PASSWORD_not_set}",
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

    def test_validate_pilot_configuration_accepts_initialized_fail_closed_env(self):
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / ".env.home"
            env.write_text(
                home_lab.render_environment(home_lab.ENV_TEMPLATE.read_text()),
                encoding="utf-8",
            )
            with patch.object(home_lab, "ENV_FILE", env):
                result = home_lab.validate_pilot_configuration()

        self.assertTrue(result["telemetry_jwt_required"])
        self.assertTrue(result["telemetry_audience_required"])
        self.assertEqual(result["telemetry_ack_mode"], "direct-db")
        self.assertTrue(result["runtime_db_role_separated"])
        self.assertTrue(result["admin_password_configured"])
        self.assertTrue(result["backup_encryption_key_valid"])

    def test_validate_pilot_configuration_rejects_unsafe_queue_mode(self):
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / ".env.home"
            rendered = home_lab.render_environment(home_lab.ENV_TEMPLATE.read_text())
            env.write_text(
                rendered.replace("TELEMETRY_INGEST_QUEUE=0", "TELEMETRY_INGEST_QUEUE=1"),
                encoding="utf-8",
            )
            with patch.object(home_lab, "ENV_FILE", env), self.assertRaises(SystemExit):
                home_lab.validate_pilot_configuration()

    def test_validate_pilot_configuration_rejects_uninitialized_secrets(self):
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / ".env.home"
            env.write_text(home_lab.ENV_TEMPLATE.read_text(), encoding="utf-8")
            with patch.object(home_lab, "ENV_FILE", env), self.assertRaises(SystemExit):
                home_lab.validate_pilot_configuration()

    def test_checked_out_commit_rejects_dirty_checkout(self):
        with patch.object(
            home_lab,
            "run_capture",
            side_effect=["a" * 40 + "\n", " M scripts/home_lab.py\n"],
        ), self.assertRaises(SystemExit):
            home_lab.checked_out_commit()

    def test_check_migrations_uses_django_non_mutating_check(self):
        with patch.object(home_lab, "require_environment"), patch.object(
            home_lab, "run"
        ) as run_mock:
            home_lab.check_migrations()

        self.assertEqual(
            run_mock.call_args.args[0][-5:],
            ["python", "manage.py", "migrate", "--check", "--no-input"],
        )

    def test_health_contract_includes_global_admin_http_surface(self):
        self.assertIn(
            ("global_admin", "http://127.0.0.1:3001/"),
            home_lab.HEALTH_ENDPOINTS,
        )

    def test_runtime_dependency_check_proves_postgres_redis_and_celery(self):
        outputs = [
            "/var/run/postgresql:5432 - accepting connections\n",
            "PONG\n",
            "->  celery@worker: OK\n        pong\n",
        ]
        with patch.object(home_lab, "require_environment"), patch.object(
            home_lab, "run_capture", side_effect=outputs
        ) as capture:
            result = home_lab.check_runtime_dependencies()

        self.assertEqual(
            result,
            {
                "postgres": "accepting_connections",
                "redis": "PONG",
                "celery_worker": "pong",
            },
        )
        commands = [call.args[0] for call in capture.call_args_list]
        self.assertIn("pg_isready", " ".join(commands[0]))
        self.assertEqual(commands[1][-2:], ["redis-cli", "ping"])
        self.assertIn("celery_worker", commands[2])
        self.assertIn("inspect", commands[2])
        self.assertIn("ping", commands[2])

    def test_runtime_dependency_check_fails_closed_without_celery_pong(self):
        outputs = [
            "/var/run/postgresql:5432 - accepting connections\n",
            "PONG\n",
            "Error: No nodes replied within time constraint\n",
        ]
        with patch.object(home_lab, "require_environment"), patch.object(
            home_lab, "run_capture", side_effect=outputs
        ), self.assertRaises(SystemExit):
            home_lab.check_runtime_dependencies()

    def test_cold_start_smoke_prints_bounded_diagnostics_on_compose_failure(self):
        failure = home_lab.subprocess.CalledProcessError(1, ["docker", "compose", "up"])
        with (
            patch.object(home_lab, "require_environment"),
            patch.object(home_lab, "checked_out_commit", return_value="e" * 40),
            patch.object(home_lab, "validate_pilot_configuration", return_value={}),
            patch.object(home_lab, "run", side_effect=[None, None, failure]),
            patch.object(home_lab, "print_startup_diagnostics") as diagnostics,
            self.assertRaises(home_lab.subprocess.CalledProcessError),
        ):
            home_lab.cold_start_smoke()

        diagnostics.assert_called_once_with()

    def test_startup_diagnostics_are_bounded_to_status_and_telemetry_logs(self):
        with patch.object(home_lab, "run") as run_mock:
            home_lab.print_startup_diagnostics()

        commands = [call.args[0] for call in run_mock.call_args_list]
        self.assertEqual(commands[0][-1], "ps")
        self.assertEqual(
            commands[1][-6:],
            ["logs", "--no-color", "--tail", "120", "telemetry"],
        )
        self.assertTrue(all(call.kwargs["check"] is False for call in run_mock.call_args_list))

    def test_cold_start_smoke_writes_exact_sha_secret_free_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            evidence_dir = Path(folder) / "evidence"
            configuration = {
                "telemetry_jwt_required": True,
                "telemetry_audience_required": True,
                "telemetry_ack_mode": "direct-db",
                "rls_runtime_role_guard": True,
                "demo_seed": False,
                "runtime_db_role_separated": True,
                "admin_password_configured": True,
                "backup_encryption_key_valid": True,
            }
            dependencies = {
                "postgres": "accepting_connections",
                "redis": "PONG",
                "celery_worker": "pong",
            }
            with (
                patch.object(home_lab, "require_environment"),
                patch.object(home_lab, "checked_out_commit", return_value="d" * 40),
                patch.object(
                    home_lab,
                    "validate_pilot_configuration",
                    return_value=configuration,
                ),
                patch.object(home_lab, "run") as run_mock,
                patch.object(home_lab, "check_health"),
                patch.object(home_lab, "check_migrations"),
                patch.object(
                    home_lab,
                    "check_runtime_dependencies",
                    return_value=dependencies,
                ),
                patch.object(home_lab, "EVIDENCE_DIR", evidence_dir),
                patch("builtins.print") as print_mock,
            ):
                report_path = home_lab.cold_start_smoke()

            report = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(report["overall_status"], "PASS")
            self.assertEqual(report["gate"], "t90-dev-env-ready")
            self.assertEqual(report["git_commit"], "d" * 40)
            self.assertEqual(report["migrations"], "no_pending")
            self.assertEqual(report["runtime_dependencies"], dependencies)
            self.assertFalse(report["persistent_volumes_deleted"])

            commands = [call.args[0] for call in run_mock.call_args_list]
            self.assertEqual(commands[0][-2:], ["down", "--remove-orphans"])
            self.assertNotIn("-v", commands[0])
            self.assertEqual(commands[1][-2:], ["config", "--quiet"])
            self.assertEqual(commands[2][-4:], ["up", "-d", "--build", "--wait"])
            printed = [call.args[0] for call in print_mock.call_args_list]
            self.assertEqual(printed[-1], "DEV ENV READY")

            serialized = report_path.read_text(encoding="utf-8")
            self.assertNotIn("SECRET_KEY", serialized)
            self.assertNotIn("ADMIN_PASSWORD", serialized)
            self.assertNotIn("TELEMETRY_INGEST_JWT_SECRET", serialized)

    def test_operator_gate_writes_commit_bound_secret_free_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            backup_path = root / "4velo-home-test.dump.enc"
            backup_path.write_bytes(b"encrypted")
            evidence_dir = root / "evidence"
            configuration = {
                "telemetry_jwt_required": True,
                "telemetry_audience_required": True,
                "telemetry_ack_mode": "direct-db",
                "rls_runtime_role_guard": True,
                "demo_seed": False,
                "runtime_db_role_separated": True,
                "admin_password_configured": True,
                "backup_encryption_key_valid": True,
            }
            with (
                patch.object(home_lab, "require_environment"),
                patch.object(home_lab, "checked_out_commit", return_value="b" * 40),
                patch.object(home_lab, "validate_pilot_configuration", return_value=configuration),
                patch.object(home_lab, "run"),
                patch.object(home_lab, "check_health"),
                patch.object(home_lab, "check_migrations"),
                patch.object(home_lab, "backup", return_value=backup_path),
                patch.object(home_lab, "file_sha256", return_value="c" * 64),
                patch.object(home_lab, "verify_restore"),
                patch.object(home_lab, "EVIDENCE_DIR", evidence_dir),
            ):
                report_path = home_lab.operator_gate()

            report = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(report["overall_status"], "PASS")
            self.assertEqual(report["git_commit"], "b" * 40)
            self.assertEqual(report["backup_sha256"], "c" * 64)
            self.assertTrue(report["isolated_restore_verified"])
            serialized = report_path.read_text(encoding="utf-8")
            self.assertNotIn("SECRET_KEY", serialized)
            self.assertNotIn("ADMIN_PASSWORD", serialized)
            self.assertNotIn("TELEMETRY_INGEST_JWT_SECRET", serialized)

    def test_grant_runtime_role_reapplies_acl_free_restore_permissions(self):
        with patch.object(home_lab, "home_env_value", return_value="4velo_runtime"), patch.object(
            home_lab, "run"
        ) as run_mock:
            home_lab.grant_runtime_role("4velo_restore_check")

        command = run_mock.call_args.args[0]
        self.assertEqual(command[-2:], ["4velo_restore_check", "4velo_runtime"])
        grant_script = command[-4]
        self.assertIn("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES", grant_script)
        self.assertIn("ALTER DEFAULT PRIVILEGES", grant_script)

    def test_restore_backup_reapplies_runtime_grants_after_success(self):
        class FakeProcess:
            def __init__(self):
                self.stdin = io.BytesIO()

            def wait(self):
                return 0

            def poll(self):
                return 0

            def terminate(self):
                pass

            def kill(self):
                pass

        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "backup.dump.enc"
            source.write_bytes(b"encrypted")
            with (
                patch.object(home_lab, "require_environment"),
                patch.object(home_lab, "validate_backup", return_value=source),
                patch.object(home_lab, "home_env_value", return_value="test-key"),
                patch.object(home_lab.subprocess, "Popen", return_value=FakeProcess()),
                patch.object(home_lab, "decrypt_file_to_stream"),
                patch.object(home_lab, "grant_runtime_role") as grant_mock,
            ):
                home_lab.restore_backup(source)

        grant_mock.assert_called_once_with(home_lab.RECOVERY_DATABASE)

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

    def test_home_env_value_can_use_explicit_default_for_legacy_env(self):
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / ".env.home"
            env.write_text("POSTGRES_DB=4velo_home\n", encoding="utf-8")
            with patch.object(home_lab, "ENV_FILE", env):
                self.assertEqual(
                    home_lab.home_env_value("APP_DB_USER", "4velo_runtime"),
                    "4velo_runtime",
                )

    def test_home_env_value_reads_requested_setting_only(self):
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / ".env.home"
            env.write_text("POSTGRES_DB=4velo_home\nSECRET_KEY=do-not-print\n", encoding="utf-8")
            with patch.object(home_lab, "ENV_FILE", env):
                self.assertEqual(home_lab.home_env_value("POSTGRES_DB"), "4velo_home")


if __name__ == "__main__":
    unittest.main()
