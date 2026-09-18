"""Behavior tests for Mobile Visual Contract path routing."""

import fnmatch
import re
import unittest
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "ci.yml"


def _workflow_text():
    return WORKFLOW.read_text(encoding="utf-8")


def _path_filters(workflow):
    lines = workflow.splitlines()
    start = next(index for index, line in enumerate(lines) if line.strip() == "filters: |")
    base_indent = len(lines[start]) - len(lines[start].lstrip())
    filters = {}
    current = None
    for line in lines[start + 1 :]:
        stripped = line.strip()
        indent = len(line) - len(line.lstrip())
        if stripped and indent <= base_indent:
            break
        category = re.fullmatch(r"([a-z][a-z0-9_-]*):", stripped)
        if category and indent == base_indent + 2:
            current = category.group(1)
            filters[current] = []
            continue
        pattern = re.fullmatch(r"- ['\"](.+)['\"]", stripped)
        if pattern and current and indent == base_indent + 4:
            filters[current].append(pattern.group(1))
    return filters


def _job_dependencies(workflow, job):
    match = re.search(
        rf"(?ms)^  {re.escape(job)}:\n(?P<body>.*?)(?=^  [a-zA-Z0-9_-]+:\n)",
        workflow,
    )
    if not match:
        raise AssertionError(f"{job} job not found")
    body = match.group("body")
    condition = re.search(r"(?m)^    if:(?P<value>.*)$", body)
    if not condition:
        raise AssertionError(f"{job} condition not found")
    return set(re.findall(r"needs\.changes\.outputs\.([a-z0-9_-]+)", condition.group("value")))


def _matches(path, pattern):
    if pattern.endswith("/**"):
        prefix = pattern[:-3].rstrip("/")
        return path == prefix or path.startswith(prefix + "/")
    return fnmatch.fnmatchcase(path, pattern)


def visual_job_runs_for(path):
    workflow = _workflow_text()
    changed = {
        category
        for category, patterns in _path_filters(workflow).items()
        if any(_matches(path, pattern) for pattern in patterns)
    }
    dependencies = _job_dependencies(workflow, "mobile-visual-contract")
    full = "workflow" in changed
    return ("full" in dependencies and full) or bool(changed & dependencies)


class VisualPathRoutingTests(unittest.TestCase):
    def test_visual_and_asset_paths_run_contract(self):
        paths = (
            "mobile/src/screens/RideDashboardScreen.tsx",
            "mobile/src/theme/grandPrix.ts",
            "mobile/src/components/ui/AppHeader.tsx",
            "assets/generated/icons/ach_100km.png",
            "assets/ASSET_GOVERNANCE_V1.json",
            "docs/design/MOBILE_UI_VISUAL_PROTECTION_ARCHITECTURE_V1.md",
            "docs/adr/014-mobile-immersive-pixel-art-and-bike-computer.md",
            "docs/pl/design/MOBILE_ASSET_NANO_BANANA_PROMPTS.md",
            "docs/pl/adr/014-mobile-immersive-pixel-art-and-bike-computer.md",
            "packages/tokens/colors.json",
            "package.json",
            "pnpm-lock.yaml",
            "pnpm-workspace.yaml",
            "scripts/audit-screen-tokens.ts",
            "scripts/validate_mobile_asset_governance.py",
            "scripts/validate_mobile_visual_authority.py",
            ".github/workflows/ci.yml",
        )
        for path in paths:
            with self.subTest(path=path):
                self.assertTrue(visual_job_runs_for(path), path)

    def test_unrelated_paths_do_not_run_contract(self):
        paths = (
            "backend/activities/views.py",
            "telemetry/main.py",
            "admin/src/App.tsx",
            "docs/backend/API.md",
            "README.md",
            "turbo.json",
        )
        for path in paths:
            with self.subTest(path=path):
                self.assertFalse(visual_job_runs_for(path), path)

    def test_visual_filter_is_explicit_and_narrow(self):
        filters = _path_filters(_workflow_text())
        self.assertIn("visual", filters)
        self.assertNotIn("docs/**", filters["visual"])
        self.assertNotIn("scripts/**", filters["visual"])

    def test_visual_job_depends_on_full_and_visual_outputs(self):
        deps = _job_dependencies(_workflow_text(), "mobile-visual-contract")
        self.assertEqual(deps, {"full", "visual"})


if __name__ == "__main__":
    unittest.main()
