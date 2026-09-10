import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import home_lab


class HomeLabTests(unittest.TestCase):
    def test_compose_command_is_pinned_to_local_project_and_env(self):
        command = home_lab.compose_command("config", "--quiet", profiles=("routing", "simulation"))
        self.assertEqual(
            command[:6],
            ["docker", "compose", "-p", "4velo-home", "--env-file", str(home_lab.ENV_FILE)],
        )
        self.assertEqual(
            command[-6:], ["--profile", "routing", "--profile", "simulation", "config", "--quiet"]
        )

    def test_render_environment_replaces_all_secret_placeholders(self):
        rendered = home_lab.render_environment(home_lab.ENV_TEMPLATE.read_text())
        self.assertNotIn("GENERATE_WITH_HOME_LAB_INIT", rendered)
        self.assertIn("TELEMETRY_INGEST_JWT_REQUIRED=1", rendered)
        values = dict(
            line.split("=", 1)
            for line in rendered.splitlines()
            if line and not line.startswith("#")
        )
        self.assertGreaterEqual(len(values["SECRET_KEY"]), 64)
        self.assertNotEqual(values["SECRET_KEY"], values["TELEMETRY_INGEST_JWT_SECRET"])

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


if __name__ == "__main__":
    unittest.main()
