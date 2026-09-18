"""Fail closed when the repository toolchain pins drift apart.

The pnpm version is declared once in package.json and must stay aligned with CI,
Docker, EAS, and local fallback tooling.  pnpm 12 currently also needs a
single-document lockfile so GitHub Dependency Graph/Dependabot do not silently
lose the workspace dependency graph.
"""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class ToolchainIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.package = json.loads(read("package.json"))
        package_manager = cls.package.get("packageManager", "")
        match = re.fullmatch(r"pnpm@(\d+\.\d+\.\d+)", package_manager)
        if not match:
            raise AssertionError("package.json must pin packageManager as pnpm@X.Y.Z")
        cls.pnpm_version = match.group(1)

    def test_pnpm_major_is_12(self):
        self.assertTrue(
            self.pnpm_version.startswith("12."),
            f"expected pnpm 12.x, got {self.pnpm_version}",
        )

    def test_package_engines_match_pnpm_pin(self):
        engines = self.package.get("engines", {})
        self.assertEqual(engines.get("pnpm"), self.pnpm_version)
        self.assertEqual(engines.get("node"), ">=22.13.0")

    def test_ci_composite_uses_root_pnpm_pin(self):
        action = read(".github/actions/pnpm-setup/action.yml")
        self.assertIn(f"version: {self.pnpm_version}", action)

    def test_node_pin_is_consistent_between_ci_and_composite(self):
        workflow = read(".github/workflows/ci.yml")
        action = read(".github/actions/pnpm-setup/action.yml")
        ci_match = re.search(r"(?m)^\s*NODE_VERSION:\s*['\"]?([^'\"\s]+)", workflow)
        action_match = re.search(r'(?m)^\s*default:\s*"([^"]+)"\s*$', action)
        self.assertIsNotNone(ci_match)
        self.assertIsNotNone(action_match)
        self.assertEqual(ci_match.group(1), action_match.group(1))
        self.assertEqual(ci_match.group(1), "22.23.2")

    def test_build_and_eas_paths_use_root_pnpm_pin(self):
        self.assertIn(
            f"pnpm@{self.pnpm_version}",
            read("admin/Dockerfile"),
        )
        self.assertIn(
            f"pnpm@{self.pnpm_version}",
            read("mobile/eas-build-pre-install.sh"),
        )
        self.assertIn(
            f"pnpm@{self.pnpm_version}",
            read("scripts/test-admin.ps1"),
        )

    def test_admin_build_uses_ci_node_pin(self):
        dockerfile = read("admin/Dockerfile")
        self.assertIn("FROM node:22.23.2-slim AS build", dockerfile)

    def test_pnpm12_settings_live_in_workspace_config(self):
        self.assertNotIn("pnpm", self.package)
        workspace = read("pnpm-workspace.yaml")
        self.assertRegex(workspace, r"(?m)^overrides:\s*$")
        self.assertRegex(workspace, r"(?m)^\s+react:\s*19\.2\.7\s*$")
        self.assertRegex(workspace, r"(?m)^\s+react-dom:\s*19\.2\.7\s*$")

    def test_dependabot_compatibility_workaround_is_enabled(self):
        workspace = read("pnpm-workspace.yaml")
        self.assertRegex(workspace, r"(?m)^pmOnFail:\s*ignore\s*$")

    def test_lockfile_stays_single_document(self):
        lockfile = read("pnpm-lock.yaml")
        separators = re.findall(r"(?m)^---\s*$", lockfile)
        self.assertEqual(
            separators,
            [],
            "pnpm-lock.yaml became multi-document; verify GitHub Dependency Graph "
            "and Dependabot support before allowing this format",
        )


if __name__ == "__main__":
    unittest.main()
