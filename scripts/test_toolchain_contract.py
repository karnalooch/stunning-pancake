"""Fail-closed contract for the JavaScript toolchain pins.

Node.js has one repository source of truth (.node-version) and pnpm has one
source of truth (root package.json#packageManager). CI must consume those pins,
and pnpm 12 must keep a single-document lockfile so GitHub dependency tooling
continues to see the dependency graph.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODE_VERSION = "24.21.0"
PNPM_VERSION = "12.4.2"


class ToolchainContractTests(unittest.TestCase):
    def test_root_toolchain_pins(self):
        self.assertEqual((ROOT / ".node-version").read_text(encoding="utf-8").strip(), NODE_VERSION)
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        self.assertEqual(package["packageManager"], f"pnpm@{PNPM_VERSION}")
        self.assertEqual(package["engines"]["node"], f">={NODE_VERSION} <25")

    def test_ci_reads_repository_pins(self):
        action = (ROOT / ".github/actions/pnpm-setup/action.yml").read_text(encoding="utf-8")
        self.assertIn("pnpm/action-setup@v6", action)
        self.assertIn("node-version-file: .node-version", action)
        self.assertNotIn("version: 9.15.0", action)
        self.assertNotIn('default: "20"', action)

        ci = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
        self.assertNotIn("NODE_VERSION", ci)
        self.assertNotIn("node-version: ${{ env.NODE_VERSION }}", ci)

    def test_pnpm_12_lockfile_stays_single_document_for_dependency_graph(self):
        workspace = (ROOT / "pnpm-workspace.yaml").read_text(encoding="utf-8")
        self.assertIn("pmOnFail: ignore", workspace)

        lockfile = (ROOT / "pnpm-lock.yaml").read_text(encoding="utf-8")
        separators = [line for line in lockfile.splitlines() if line.strip() == "---"]
        self.assertEqual(
            separators,
            [],
            "pnpm-lock.yaml must remain a single YAML document for GitHub dependency tooling",
        )

    def test_admin_and_eas_use_node_24_and_pnpm_12(self):
        dockerfile = (ROOT / "admin/Dockerfile").read_text(encoding="utf-8")
        self.assertIn(f"FROM node:{NODE_VERSION}-slim AS build", dockerfile)
        self.assertIn(f"corepack prepare pnpm@{PNPM_VERSION} --activate", dockerfile)

        eas_preinstall = (ROOT / "mobile/eas-build-pre-install.sh").read_text(encoding="utf-8")
        self.assertIn(f"corepack prepare pnpm@{PNPM_VERSION} --activate", eas_preinstall)

        for path in (ROOT / "eas.json", ROOT / "mobile/eas.json"):
            payload = json.loads(path.read_text(encoding="utf-8"))
            for profile, config in payload["build"].items():
                with self.subTest(path=path.name, profile=profile):
                    self.assertEqual(config["node"], NODE_VERSION)


if __name__ == "__main__":
    unittest.main()
