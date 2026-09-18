"""Fail closed when Node.js or pnpm toolchain pins drift across the monorepo."""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODE_VERSION = "24.21.0"
PNPM_VERSION = "12.4.2"


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class ToolchainVersionContractTests(unittest.TestCase):
    def test_root_manifest_declares_canonical_toolchain(self):
        package = json.loads(read("package.json"))
        self.assertEqual(package.get("packageManager"), f"pnpm@{PNPM_VERSION}")
        self.assertEqual(package.get("engines", {}).get("node"), f">={NODE_VERSION} <25")
        self.assertEqual(read(".nvmrc").strip(), NODE_VERSION)

    def test_shared_pnpm_action_uses_canonical_versions(self):
        action = read(".github/actions/pnpm-setup/action.yml")
        self.assertRegex(action, rf'default:\s*"{re.escape(NODE_VERSION)}"')
        self.assertRegex(action, rf'version:\s*{re.escape(PNPM_VERSION)}')
        self.assertIn("uses: pnpm/action-setup@v6", action)

    def test_pnpm_version_management_is_external_and_lockfile_stays_single_document(self):
        workspace = read("pnpm-workspace.yaml")
        lockfile = read("pnpm-lock.yaml")
        self.assertRegex(workspace, r"(?m)^pmOnFail:\s*ignore\s*$")
        self.assertRegex(workspace, r"(?m)^overrides:\s*$")
        self.assertIn("react: 19.2.7", workspace)
        self.assertIn("react-dom: 19.2.7", workspace)
        self.assertNotIn(
            "packageManagerDependencies:",
            lockfile,
            "GitHub Dependency Graph/Dependabot still mishandles pnpm's env lockfile document",
        )
        self.assertEqual(
            lockfile.count("\n---\n"),
            0,
            "pnpm-lock.yaml must remain a single YAML document until GitHub supports pnpm 12 env lockfiles",
        )

    def test_ci_workflows_use_node_24(self):
        ci = read(".github/workflows/ci.yml")
        release = read(".github/workflows/k8s-release-gate.yml")
        smoke = read(".github/workflows/live-map-prod-smoke.yml")
        self.assertIn(f"NODE_VERSION: '{NODE_VERSION}'", ci)
        self.assertIn(f'NODE_VERSION: "{NODE_VERSION}"', release)
        self.assertIn(f"node-version: '{NODE_VERSION}'", smoke)

    def test_runtime_build_entrypoints_use_canonical_toolchain(self):
        dockerfile = read("admin/Dockerfile")
        eas_preinstall = read("mobile/eas-build-pre-install.sh")
        self.assertIn(f"FROM node:{NODE_VERSION}-slim AS build", dockerfile)
        self.assertIn(f"corepack prepare pnpm@{PNPM_VERSION} --activate", dockerfile)
        self.assertIn(f"corepack prepare pnpm@{PNPM_VERSION} --activate", eas_preinstall)

    def test_all_eas_profiles_use_node_24(self):
        for path in ("eas.json", "mobile/eas.json"):
            payload = json.loads(read(path))
            build = payload.get("build", {})
            self.assertGreater(len(build), 0, path)
            for profile, config in build.items():
                with self.subTest(path=path, profile=profile):
                    self.assertEqual(config.get("node"), NODE_VERSION)

    def test_known_operational_helpers_do_not_reintroduce_old_pnpm(self):
        sources = (
            "scripts/test-admin.ps1",
            "admin/README.md",
            "CONTRIBUTING.md",
            "docs/en/operations/MOBILE.md",
        )
        for path in sources:
            with self.subTest(path=path):
                source = read(path)
                self.assertNotIn("pnpm@9.15.0", source)
                self.assertIn(f"pnpm@{PNPM_VERSION}", source)


if __name__ == "__main__":
    unittest.main()
