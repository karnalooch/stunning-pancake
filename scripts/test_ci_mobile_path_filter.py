"""Behavior tests for the mobile job's pull-request path routing."""

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


def _mobile_dependencies(workflow):
    match = re.search(r"(?ms)^  mobile:\n(?P<body>.*?)(?=^  [a-zA-Z0-9_-]+:\n)", workflow)
    if not match:
        raise AssertionError("mobile job not found")
    condition = re.search(r"(?m)^    if:(?P<value>.*)$", match.group("body"))
    if not condition:
        raise AssertionError("mobile job condition not found")
    return set(re.findall(r"needs\.changes\.outputs\.([a-z0-9_-]+)", condition.group("value")))


def _matches(path, pattern):
    if pattern.endswith("/**"):
        prefix = pattern[:-3].rstrip("/")
        return path == prefix or path.startswith(prefix + "/")
    return fnmatch.fnmatchcase(path, pattern)


def mobile_job_runs_for(path):
    workflow = _workflow_text()
    changed = {
        category
        for category, patterns in _path_filters(workflow).items()
        if any(_matches(path, pattern) for pattern in patterns)
    }
    dependencies = _mobile_dependencies(workflow)
    full = "workflow" in changed
    return ("full" in dependencies and full) or bool(changed & dependencies)


class MobilePathRoutingTests(unittest.TestCase):
    def test_mobile_impacting_paths_run_mobile_job(self):
        paths = (
            "mobile/src/screens/HomeScreen.tsx",
            "packages/tokens/colors.json",
            "pnpm-lock.yaml",
            "pnpm-workspace.yaml",
            "package.json",
            ".npmrc",
            ".github/actions/pnpm-setup/action.yml",
            ".github/workflows/ci.yml",
        )
        for path in paths:
            with self.subTest(path=path):
                self.assertTrue(mobile_job_runs_for(path), path)

    def test_unrelated_paths_do_not_run_mobile_job(self):
        paths = (
            "backend/activities/views.py",
            "docs/PROJECT_TAKEOVER.md",
            "README.md",
            "turbo.json",
        )
        for path in paths:
            with self.subTest(path=path):
                self.assertFalse(mobile_job_runs_for(path), path)


if __name__ == "__main__":
    unittest.main()
