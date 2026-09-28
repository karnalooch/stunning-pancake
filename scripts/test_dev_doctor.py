"""Tests for the T89 developer-environment doctor."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import dev_doctor


class FakeRunner:
    def __init__(self, root: Path, *, node: str = "24.21.0", pnpm: str = "12.4.2"):
        self.root = root
        self.node = node
        self.pnpm = pnpm

    def __call__(self, args):
        command = tuple(args)
        responses = {
            ("git", "rev-parse", "--show-toplevel"): dev_doctor.CommandResult(
                0, str(self.root)
            ),
            ("node", "--version"): dev_doctor.CommandResult(0, f"v{self.node}"),
            ("corepack", "--version"): dev_doctor.CommandResult(0, "0.34.5"),
            ("pnpm", "--version"): dev_doctor.CommandResult(0, self.pnpm),
            ("docker", "compose", "version", "--short"): dev_doctor.CommandResult(
                0, "2.40.0"
            ),
            (
                "docker",
                "version",
                "--format",
                "{{.Server.Version}}",
            ): dev_doctor.CommandResult(0, "29.0.0"),
        }
        return responses.get(command, dev_doctor.CommandResult(127, "unexpected command"))


def make_repo(root: Path) -> None:
    (root / "scripts").mkdir()
    (root / "scripts" / "home_lab.py").write_text("# fixture\n", encoding="utf-8")
    (root / "package.json").write_text(
        json.dumps(
            {
                "packageManager": "pnpm@12.4.2",
                "engines": {"node": ">=24.21.0 <25"},
            }
        ),
        encoding="utf-8",
    )
    (root / ".nvmrc").write_text("24.21.0\n", encoding="utf-8")
    for path in ("pnpm-lock.yaml", "docker-compose.yml", "docker-compose.home.yml"):
        (root / path).write_text("# fixture\n", encoding="utf-8")


class DevDoctorTests(unittest.TestCase):
    def test_tracked_toolchain_contract_matches_repo_pins(self):
        contract = dev_doctor.load_toolchain_contract()
        self.assertEqual(contract.node, "24.21.0")
        self.assertEqual(contract.node_engine, ">=24.21.0 <25")
        self.assertEqual(contract.pnpm, "12.4.2")

    def test_compliant_machine_passes_without_reading_secrets(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            make_repo(root)
            checks = dev_doctor.collect_checks(
                root=root,
                runner=FakeRunner(root),
                python_version=(3, 12),
                memory_bytes=16 * dev_doctor.GIB,
                free_disk_bytes=40 * dev_doctor.GIB,
            )

        failures = [check for check in checks if check.status == "FAIL"]
        self.assertEqual(failures, [])
        self.assertEqual(checks[-1].name, "home-lab environment")
        self.assertIn("not created yet", checks[-1].detail)

    def test_wrong_node_fails_with_actionable_remediation(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            make_repo(root)
            checks = dev_doctor.collect_checks(
                root=root,
                runner=FakeRunner(root, node="24.20.0"),
                python_version=(3, 12),
                memory_bytes=16 * dev_doctor.GIB,
                free_disk_bytes=40 * dev_doctor.GIB,
            )

        node = next(check for check in checks if check.name == "node")
        self.assertEqual(node.status, "FAIL")
        self.assertIn("expected 24.21.0", node.detail)
        self.assertIn(".nvmrc", node.remediation)

    def test_unavailable_docker_daemon_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            make_repo(root)
            base = FakeRunner(root)

            def runner(args):
                if tuple(args) == (
                    "docker",
                    "version",
                    "--format",
                    "{{.Server.Version}}",
                ):
                    return dev_doctor.CommandResult(1, "Cannot connect to Docker daemon")
                return base(args)

            checks = dev_doctor.collect_checks(
                root=root,
                runner=runner,
                python_version=(3, 12),
                memory_bytes=16 * dev_doctor.GIB,
                free_disk_bytes=40 * dev_doctor.GIB,
            )

        daemon = next(check for check in checks if check.name == "docker daemon")
        self.assertEqual(daemon.status, "FAIL")
        self.assertIn("Start Docker", daemon.remediation)

    def test_resource_requirements_are_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            make_repo(root)
            checks = dev_doctor.collect_checks(
                root=root,
                runner=FakeRunner(root),
                python_version=(3, 12),
                memory_bytes=8 * dev_doctor.GIB,
                free_disk_bytes=20 * dev_doctor.GIB,
            )

        statuses = {check.name: check.status for check in checks}
        self.assertEqual(statuses["memory"], "FAIL")
        self.assertEqual(statuses["free disk"], "FAIL")

    def test_python_312_or_newer_is_supported(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            make_repo(root)
            for version in ((3, 12), (3, 14)):
                with self.subTest(version=version):
                    checks = dev_doctor.collect_checks(
                        root=root,
                        runner=FakeRunner(root),
                        python_version=version,
                        memory_bytes=16 * dev_doctor.GIB,
                        free_disk_bytes=40 * dev_doctor.GIB,
                    )
                    python_check = next(
                        check for check in checks if check.name == "python"
                    )
                    self.assertEqual(python_check.status, "PASS")

    def test_next_steps_generate_secrets_only_through_home_lab_init(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            make_repo(root)
            without_env = dev_doctor.next_steps(root)
            self.assertIn("python scripts/home_lab.py init", without_env)
            self.assertIn("python scripts/home_lab.py config", without_env)
            self.assertIn("python scripts/home_lab.py up", without_env)

            (root / ".env.home").write_text("DO_NOT_READ_ME=secret\n", encoding="utf-8")
            with_env = dev_doctor.next_steps(root)
            self.assertNotIn("python scripts/home_lab.py init", with_env)
            self.assertNotIn("secret", "\n".join(with_env))

    def test_incomplete_checkout_fails_before_command_execution(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)

            def forbidden_runner(_args):
                raise AssertionError("commands must not run for incomplete checkout")

            checks = dev_doctor.collect_checks(
                root=root,
                runner=forbidden_runner,
                python_version=(3, 12),
                memory_bytes=16 * dev_doctor.GIB,
                free_disk_bytes=40 * dev_doctor.GIB,
            )

        self.assertEqual(len(checks), 1)
        self.assertEqual(checks[0].status, "FAIL")
        self.assertIn("missing:", checks[0].detail)


if __name__ == "__main__":
    unittest.main()
