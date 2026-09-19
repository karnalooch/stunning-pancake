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
        npmrc = read(".npmrc")
        lockfile = read("pnpm-lock.yaml")
        self.assertRegex(workspace, r"(?m)^nodeLinker:\s*isolated\s*$")
        self.assertNotRegex(workspace, r"(?m)^shamefullyHoist:")
        self.assertNotRegex(workspace, r"(?m)^publicHoistPattern:")
        self.assertNotIn("node-linker", npmrc)
        self.assertNotIn("shamefully-hoist", npmrc)
        self.assertNotIn("public-hoist-pattern", npmrc)
        self.assertRegex(workspace, r"(?m)^pmOnFail:\s*ignore\s*$")
        self.assertRegex(workspace, r"(?m)^overrides:\s*$")
        self.assertNotRegex(
            workspace,
            r"(?m)^  react:\s*19[.]2[.]7\s*$",
            "mobile's Expo React version must not be overridden repo-wide",
        )
        self.assertNotRegex(
            workspace,
            r"(?m)^  react-dom:\s*19[.]2[.]7\s*$",
            "mobile's Expo React DOM version must not be overridden repo-wide",
        )
        expected_build_policy = (
            "'@shopify/react-native-skia@2.4.18': true",
            "'electron@44.4.1': true",
            "'electron-winstaller@5.4.0': true",
            "'esbuild@0.25.12 || 0.28.1': false",
            "'protobufjs@7.6.5': false",
            "'unrs-resolver@1.12.2': false",
        )
        self.assertRegex(workspace, r"(?m)^allowBuilds:\s*$")
        for rule in expected_build_policy:
            with self.subTest(rule=rule):
                self.assertIn(rule, workspace)
        self.assertNotIn("dangerouslyAllowAllBuilds: true", workspace)
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
        mobile_package = json.loads(read("mobile/package.json"))
        self.assertIn(f"FROM node:{NODE_VERSION}-slim AS build", dockerfile)
        self.assertIn(f"corepack prepare pnpm@{PNPM_VERSION} --activate", dockerfile)
        self.assertNotIn("eas-build-pre-install", mobile_package.get("scripts", {}))
        self.assertFalse(
            (ROOT / "mobile" / "eas-build-pre-install.sh").exists(),
            "EAS should own the monorepo dependency install lifecycle",
        )

    def test_mobile_eas_profiles_use_node_24(self):
        payload = json.loads(read("mobile/eas.json"))
        build = payload.get("build", {})
        self.assertGreater(len(build), 0, "mobile/eas.json")
        for profile, config in build.items():
            with self.subTest(profile=profile):
                self.assertEqual(config.get("node"), NODE_VERSION)

    def test_mobile_is_the_only_eas_config_root(self):
        self.assertFalse((ROOT / "eas.json").exists(), "root eas.json is forbidden")
        self.assertFalse((ROOT / ".easignore").exists(), "root .easignore is forbidden")
        self.assertTrue((ROOT / "mobile" / "eas.json").is_file())
        self.assertTrue((ROOT / "mobile" / ".easignore").is_file())

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
                self.assertRegex(
                    source,
                    rf"pnpm(?:@|\s+){re.escape(PNPM_VERSION)}",
                    f"{path} must mention the canonical pnpm {PNPM_VERSION} toolchain",
                )


if __name__ == "__main__":
    unittest.main()
