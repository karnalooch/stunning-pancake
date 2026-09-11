"""Behavior tests for the T22 aggregate CI gate and the Audit routing fix."""

import json
import os
import re
import subprocess
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WORKFLOW = REPO / ".github" / "workflows" / "ci.yml"
TURBO = REPO / "turbo.json"
SCRIPT = REPO / "scripts" / "check_ci_aggregate.py"

_SCRIPTS_DIR = str(REPO / "scripts")
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)


def _workflow_text():
    return WORKFLOW.read_text(encoding="utf-8")


def _job_block(workflow, name):
    match = re.search(
        rf"(?ms)^  {re.escape(name)}:\n(?P<body>(?:^    .*\n|{{.*?\n.*?^\s*\}}\n|^    [^\n]*\n)*)",
        workflow,
    )
    return match.group("body") if match else None


def _aggregate_block(workflow):
    return _job_block(workflow, "aggregate")


def _audit_block(workflow):
    return _job_block(workflow, "audit")


def _if_condition(block):
    m = re.search(r"(?m)^    if:\s*\|\n((?:      .*\n)+)", block or "")
    if m:
        return m.group(1)
    m = re.search(r"(?m)^    if:\s*(?P<v>.+?)\n", block or "")
    return m.group("v") if m else ""


def _all_job_names(workflow):
    return re.findall(r"(?m)^  ([a-z][a-z0-9_-]*):$", workflow)


def _path_filter_patterns(workflow):
    lines = workflow.splitlines()
    start = next(i for i, line in enumerate(lines) if line.strip() == "filters: |")
    base_indent = len(lines[start]) - len(lines[start].lstrip())
    filters = {}
    current = None
    for line in lines[start + 1 :]:
        stripped = line.strip()
        if not stripped:
            continue
        indent = len(line) - len(line.lstrip())
        if indent <= base_indent:
            break
        cat = re.fullmatch(r"([a-z][a-z0-9_-]*):", stripped)
        if cat and indent == base_indent + 2:
            current = cat.group(1)
            filters[current] = []
            continue
        pat = re.fullmatch(r"- ['\"](.+)['\"]", stripped)
        if pat and current and indent == base_indent + 4:
            filters[current].append(pat.group(1))
    return filters


def _scripts_python_block(workflow):
    return _job_block(workflow, "scripts-python")


PATH_EXPECTED = {
    "backend": ["backend", "scripts-python"],
    "telemetry": ["telemetry"],
    "mobile": ["mobile", "security"],
    "admin": ["admin", "audit", "security", "e2e"],
    "packages": ["mobile", "admin", "repo-assets"],
    "scripts": ["scripts-python", "audit"],
    "docs": ["docs-links"],
}
FULL_JOBS = [
    "backend",
    "telemetry",
    "mobile",
    "scripts-python",
    "repo-assets",
    "docs-links",
    "admin",
    "audit",
    "security",
    "trivy",
    "e2e",
]


def _make_needs(outputs=None, results=None):
    base_outputs = {
        "full": "false",
        "workflow": "false",
        "backend": "false",
        "telemetry": "false",
        "mobile": "false",
        "admin": "false",
        "packages": "false",
        "scripts": "false",
        "docs": "false",
    }
    if outputs:
        base_outputs.update(outputs)
    outputs = base_outputs
    results = results or {}
    jobs = {"changes": {"result": "success", "outputs": dict(outputs)}}
    for j in FULL_JOBS:
        jobs[j] = {"result": results.get(j, "success"), "outputs": {}}
    return jobs


def _force(job, result):
    n = _make_needs(outputs={"full": "true"})
    n[job] = {"result": result, "outputs": {}}
    return n


def _force_outputs(outputs, results=None):
    return _make_needs(outputs=outputs, results=results)


class _AggregateImportProxy:
    def __init__(self):
        self.mod = None
        try:
            import check_ci_aggregate as mod  # type: ignore

            self.mod = mod
        except Exception:
            pass


class WorkflowStructureTests(unittest.TestCase):
    def test_aggregate_job_present(self):
        self.assertIsNotNone(_aggregate_block(_workflow_text()), "aggregate job missing")

    def test_aggregate_name(self):
        block = _aggregate_block(_workflow_text())
        m = re.search(r"(?m)^    name:\s*(?P<v>.+?)\s*$", block or "")
        self.assertEqual(m.group("v"), "Aggregate CI gate")

    def test_aggregate_if_always(self):
        block = _aggregate_block(_workflow_text())
        cond = _if_condition(block)
        self.assertIn("always()", cond)

    def test_aggregate_timeout(self):
        block = _aggregate_block(_workflow_text())
        m = re.search(r"(?m)^    timeout-minutes:\s*(?P<v>\d+)\s*$", block or "")
        self.assertEqual(m.group("v"), "15")

    def test_aggregate_no_continue_on_error(self):
        block = _aggregate_block(_workflow_text())
        self.assertNotIn("continue-on-error", block or "")

    def test_aggregate_needs_complete(self):
        block = _aggregate_block(_workflow_text())
        m = re.search(r"(?m)^    needs:\s*\[\s*(?P<v>[^\]]+?)\s*\]", block or "")
        self.assertIsNotNone(m, "aggregate needs list missing")
        needed = {x.strip() for x in m.group("v").split(",")}
        expected = {
            "changes",
            "backend",
            "telemetry",
            "mobile",
            "scripts-python",
            "repo-assets",
            "docs-links",
            "admin",
            "audit",
            "security",
            "trivy",
            "e2e",
        }
        self.assertEqual(needed, expected)

    def test_aggregate_no_self_dependency(self):
        block = _aggregate_block(_workflow_text())
        m = re.search(r"(?m)^    needs:\s*\[\s*(?P<v>[^\]]+?)\s*\]", block or "")
        needed = {x.strip() for x in m.group("v").split(",")}
        self.assertNotIn("aggregate", needed)

    def test_no_other_job_depends_on_aggregate(self):
        workflow = _workflow_text()
        for job in _all_job_names(workflow):
            if job == "aggregate":
                continue
            block = _job_block(workflow, job)
            m = re.search(r"(?m)^    needs:\s*\[\s*(?P<v>[^\]]+?)\s*\]", block or "")
            if not m:
                continue
            needed = {x.strip() for x in m.group("v").split(",")}
            self.assertNotIn("aggregate", needed, f"job {job} must not depend on aggregate")

    def test_aggregate_has_checkout(self):
        block = _aggregate_block(_workflow_text())
        self.assertIn("actions/checkout", block or "")

    def test_aggregate_has_setup_python(self):
        block = _aggregate_block(_workflow_text())
        self.assertIn("setup-python", block or "")

    def test_aggregate_env_exposes_ci_needs_json_and_event(self):
        block = _aggregate_block(_workflow_text())
        self.assertIn("CI_NEEDS_JSON", block or "")
        self.assertIn("CI_EVENT_NAME", block or "")

    def test_aggregate_runs_check_ci_aggregate(self):
        block = _aggregate_block(_workflow_text())
        self.assertIn("python scripts/check_ci_aggregate.py", block or "")

    def test_scripts_python_runs_new_test(self):
        block = _scripts_python_block(_workflow_text())
        self.assertIn("test_ci_aggregate.py", block or "")

    def test_audit_accepts_skipped_admin(self):
        block = _audit_block(_workflow_text())
        cond = _if_condition(block)
        self.assertIn("always()", cond)
        self.assertIn("admin.result", cond)
        self.assertTrue(
            "'skipped'" in cond or '"skipped"' in cond,
            "audit if must accept admin.result == 'skipped'",
        )

    def test_audit_rejects_failed_or_cancelled_admin(self):
        block = _audit_block(_workflow_text())
        cond = _if_condition(block)
        self.assertNotIn("failure", cond)
        self.assertNotIn("cancelled", cond)

    def test_turbo_json_not_in_packages_path_filter(self):
        filters = _path_filter_patterns(_workflow_text())
        pkgs = filters.get("packages", [])
        self.assertNotIn("turbo.json", pkgs)


class AggregateScriptTests(unittest.TestCase):
    def setUp(self):
        self.mod = _AggregateImportProxy().mod

    def _eval(self, needs, event_name):
        if self.mod is None:
            self.fail("check_ci_aggregate module not importable")
        return self.mod.evaluate(needs, event_name)

    def test_module_importable(self):
        self.assertIsNotNone(
            self.mod, "scripts/check_ci_aggregate.py must exist and import cleanly"
        )

    def test_push_all_success_pass(self):
        ok, reasons = self._eval(_force_outputs({"full": "true"}), "push")
        self.assertTrue(ok, reasons)

    def test_schedule_all_success_pass(self):
        ok, reasons = self._eval(_force_outputs({"full": "true"}), "schedule")
        self.assertTrue(ok, reasons)

    def test_push_without_full_fails(self):
        ok, reasons = self._eval(_force_outputs({"full": "false"}), "push")
        self.assertFalse(ok)
        self.assertTrue(any("full" in reason for reason in reasons), reasons)

    def test_schedule_without_full_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"full": "false"}),
            "schedule",
        )
        self.assertFalse(ok)
        self.assertTrue(any("full" in reason for reason in reasons), reasons)

    def test_push_with_skipped_fails(self):
        ok, reasons = self._eval(_force_outputs({"full": "true"}, {"backend": "skipped"}), "push")
        self.assertFalse(ok)
        self.assertTrue(any("backend" in r for r in reasons), reasons)

    def test_docs_path_docs_links_success_pass(self):
        ok, reasons = self._eval(_force_outputs({"docs": "true"}), "pull_request")
        self.assertTrue(ok, reasons)

    def test_docs_path_docs_links_skipped_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"docs": "true"}, {"docs-links": "skipped"}), "pull_request"
        )
        self.assertFalse(ok)
        self.assertTrue(any("docs-links" in r for r in reasons), reasons)

    def test_backend_path_backend_skipped_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"backend": "true"}, {"backend": "skipped"}), "pull_request"
        )
        self.assertFalse(ok)
        self.assertTrue(any("backend" in r for r in reasons), reasons)

    def test_backend_path_scripts_python_skipped_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"backend": "true"}, {"scripts-python": "skipped"}),
            "pull_request",
        )
        self.assertFalse(ok)
        self.assertTrue(any("scripts-python" in r for r in reasons), reasons)

    def test_packages_path_pass(self):
        ok, reasons = self._eval(_force_outputs({"packages": "true"}), "pull_request")
        self.assertTrue(ok, reasons)

    def test_packages_path_mobile_skipped_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"packages": "true"}, {"mobile": "skipped"}),
            "pull_request",
        )
        self.assertFalse(ok)
        self.assertTrue(any("mobile" in r for r in reasons), reasons)

    def test_packages_path_admin_skipped_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"packages": "true"}, {"admin": "skipped"}),
            "pull_request",
        )
        self.assertFalse(ok)
        self.assertTrue(any("admin" in r for r in reasons), reasons)

    def test_packages_path_repo_assets_skipped_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"packages": "true"}, {"repo-assets": "skipped"}),
            "pull_request",
        )
        self.assertFalse(ok)
        self.assertTrue(any("repo-assets" in r for r in reasons), reasons)

    def test_admin_path_pass(self):
        ok, reasons = self._eval(_force_outputs({"admin": "true"}), "pull_request")
        self.assertTrue(ok, reasons)

    def test_admin_path_audit_skipped_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"admin": "true"}, {"audit": "skipped"}),
            "pull_request",
        )
        self.assertFalse(ok)
        self.assertTrue(any("audit" in r for r in reasons), reasons)

    def test_admin_path_e2e_skipped_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"admin": "true"}, {"e2e": "skipped"}),
            "pull_request",
        )
        self.assertFalse(ok)
        self.assertTrue(any("e2e" in r for r in reasons), reasons)

    def test_scripts_path_admin_skipped_audit_success_pass(self):
        ok, reasons = self._eval(
            _force_outputs({"scripts": "true"}, {"admin": "skipped"}),
            "pull_request",
        )
        self.assertTrue(ok, reasons)

    def test_scripts_path_audit_skipped_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"scripts": "true"}, {"audit": "skipped"}),
            "pull_request",
        )
        self.assertFalse(ok)
        self.assertTrue(any("audit" in r for r in reasons), reasons)

    def test_mobile_path_security_skipped_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"mobile": "true"}, {"security": "skipped"}),
            "pull_request",
        )
        self.assertFalse(ok)
        self.assertTrue(any("security" in r for r in reasons), reasons)

    def test_unexpected_job_success_pass(self):
        needs = _force_outputs({"backend": "true"})
        needs["trivy"] = {"result": "skipped", "outputs": {}}
        ok, reasons = self._eval(needs, "pull_request")
        self.assertTrue(ok, reasons)

    def test_any_failure_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"full": "true"}, {"backend": "failure"}),
            "push",
        )
        self.assertFalse(ok)
        self.assertTrue(any("backend" in r for r in reasons), reasons)

    def test_any_cancelled_fails(self):
        ok, reasons = self._eval(
            _force_outputs({"full": "true"}, {"e2e": "cancelled"}),
            "push",
        )
        self.assertFalse(ok)
        self.assertTrue(any("e2e" in r for r in reasons), reasons)

    def test_changes_failure_fails(self):
        needs = _force_outputs({"full": "true"})
        needs["changes"] = {"result": "failure", "outputs": {"full": "true"}}
        ok, reasons = self._eval(needs, "push")
        self.assertFalse(ok)
        self.assertTrue(any("changes" in r for r in reasons), reasons)

    def test_empty_json_fails(self):
        ok, _ = self._eval({}, "push")
        self.assertFalse(ok)

    def test_missing_job_fails(self):
        needs = _force_outputs({"full": "true"})
        del needs["backend"]
        ok, reasons = self._eval(needs, "push")
        self.assertFalse(ok)
        self.assertTrue(any("backend" in r or "missing" in r.lower() for r in reasons), reasons)

    def test_missing_output_fails(self):
        needs = _force_outputs({"backend": "true"})
        del needs["changes"]["outputs"]["backend"]
        ok, reasons = self._eval(needs, "pull_request")
        self.assertFalse(ok)

    def test_invalid_output_value_fails(self):
        ok, reasons = self._eval(_force_outputs({"backend": "yes"}), "pull_request")
        self.assertFalse(ok)

    def test_unknown_event_fails(self):
        ok, _ = self._eval(_force_outputs({"full": "true"}), "workflow_dispatch")
        self.assertFalse(ok)

    def test_unknown_result_fails(self):
        needs = _force_outputs({"full": "true"}, {"backend": "weird"})
        ok, reasons = self._eval(needs, "push")
        self.assertFalse(ok)
        self.assertTrue(any("backend" in r for r in reasons), reasons)

    def test_workflow_output_triggers_full_mode(self):
        ok, reasons = self._eval(_force_outputs({"workflow": "true"}), "pull_request")
        self.assertTrue(ok, reasons)

    def test_script_output_no_raw_json(self):
        if self.mod is None:
            self.fail("check_ci_aggregate module not importable")
        needs = _force_outputs({"full": "true"})
        env = {
            **os.environ,
            "CI_NEEDS_JSON": json.dumps(needs),
            "CI_EVENT_NAME": "push",
        }
        proc = subprocess.run(
            [sys.executable, str(SCRIPT)],
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        for needle in (json.dumps(needs), '"result"', '"outputs"'):
            self.assertNotIn(needle, out, f"script leaked JSON-like content: {needle}")


if __name__ == "__main__":
    unittest.main()
