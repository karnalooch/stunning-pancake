"""Exercise shell dispatch without Django, Docker, a database or real credentials."""
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ENTRYPOINT = Path(__file__).resolve().parents[1] / "backend/docker-entrypoint.sh"


class EntrypointTests(unittest.TestCase):
    def run_entrypoint(self, args=(), seed="0", fail_migrate=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            log = root / "calls"
            for name in ("python", "gunicorn", "celery"):
                stub = root / name
                stub.write_text('#!/bin/sh\nprintf "%s\\n" "' + name + ' $*" >> "$CALL_LOG"\n'
                                'if [ "${FAIL_MIGRATE:-0}" = 1 ] && [ "${2:-}" = migrate ]; then exit 7; fi\n')
                stub.chmod(0o755)
            env = {**os.environ, "PATH": str(root) + ":" + os.environ["PATH"],
                   "CALL_LOG": str(log), "RUN_DEMO_SEED": seed,
                   "FAIL_MIGRATE": "1" if fail_migrate else "0"}
            result = subprocess.run(["sh", str(ENTRYPOINT), *args], env=env, capture_output=True)
            return result.returncode, log.read_text().splitlines() if log.exists() else []

    def test_worker_only_runs_worker(self):
        code, calls = self.run_entrypoint(("celery", "-A", "core", "worker"))
        self.assertEqual(code, 0)
        self.assertEqual(calls, ["celery -A core worker"])

    def test_default_web_start_initializes_without_demo(self):
        code, calls = self.run_entrypoint()
        self.assertEqual(code, 0)
        self.assertEqual(calls[:3], ["python manage.py migrate --no-input",
                                    "python manage.py create_admin", "python manage.py collectstatic --no-input"])
        self.assertTrue(calls[3].startswith("gunicorn "))
        self.assertEqual(len(calls), 4)

    def test_demo_is_opt_in(self):
        code, calls = self.run_entrypoint(seed="1")
        self.assertEqual(code, 0)
        self.assertIn("python seed_data.py", calls)

    def test_failed_migration_stops_web_start(self):
        code, calls = self.run_entrypoint(fail_migrate=True)
        self.assertEqual(code, 7)
        self.assertEqual(calls, ["python manage.py migrate --no-input"])
