"""Fail closed when a pnpm workspace selector cannot match a workspace package.

This guards against false-green CI such as `pnpm --filter mobile ...` when the
workspace package is actually named differently.
"""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_FILE = ROOT / "pnpm-workspace.yaml"
WORKFLOWS = ROOT / ".github" / "workflows"
BASELINE_FILES = (
    ROOT / "scripts" / "run-quality-baseline.ps1",
    ROOT / "scripts" / "run-quality-baseline.sh",
)

FILTER_RE = re.compile(r"\bpnpm\s+--filter\s+([^\s'\";]+)")


def workspace_manifest_paths():
    patterns = []
    for line in WORKSPACE_FILE.read_text(encoding="utf-8").splitlines():
        match = re.fullmatch(r"\s*-\s*[\"']?([^\"']+)[\"']?\s*", line)
        if match:
            patterns.append(match.group(1))

    manifests = []
    for pattern in patterns:
        for path in ROOT.glob(pattern):
            manifest = path / "package.json"
            if manifest.is_file():
                manifests.append(manifest)
    return sorted(set(manifests))


def workspace_package_names():
    names = set()
    for manifest in workspace_manifest_paths():
        payload = json.loads(manifest.read_text(encoding="utf-8"))
        name = payload.get("name")
        if isinstance(name, str) and name:
            names.add(name)
    return names


def ci_selector_sources():
    sources = {}
    for path in sorted(WORKFLOWS.glob("*.yml")):
        sources[str(path.relative_to(ROOT))] = path.read_text(encoding="utf-8")
    for path in BASELINE_FILES:
        sources[str(path.relative_to(ROOT))] = path.read_text(encoding="utf-8")
    return sources


class WorkspaceSelectorIntegrityTests(unittest.TestCase):
    def test_every_exact_pnpm_filter_matches_a_workspace_package(self):
        names = workspace_package_names()
        self.assertGreater(len(names), 0)

        selectors = []
        for source, text in ci_selector_sources().items():
            for selector in FILTER_RE.findall(text):
                selectors.append((source, selector))
                with self.subTest(source=source, selector=selector):
                    self.assertIn(
                        selector,
                        names,
                        f"{source}: pnpm --filter {selector} matches no workspace package",
                    )

        self.assertGreater(len(selectors), 0)

    def test_mobile_directory_is_not_addressed_as_a_package_name(self):
        self.assertNotIn("mobile", workspace_package_names())
        for source, text in ci_selector_sources().items():
            with self.subTest(source=source):
                self.assertNotIn("pnpm --filter mobile", text)


if __name__ == "__main__":
    unittest.main()
