"""Behavior tests for the T22 aggregate CI gate and the Audit routing fix.

Contract fixtures used by these tests model GitHub Actions' ``needs`` context.
They are NOT captures of any production payload; they are constructed fixtures
shaped exactly like ``${{ toJson(needs) }}`` so the aggregate policy can be
exercised against the real schema:

    { "<job>": { "result": "<success|skipped|failure|cancelled>",
                 "outputs": { ... } } }

This file is intentionally split into:

  * WorkflowStructureTests — structural invariants of ``.github/workflows/ci.yml``
    (aggregate job wiring, audit routing fix, packages filter excludes turbo).
  * AggregateScriptTests — behavior of ``scripts/check_ci_aggregate.py`` driven
    by realistic partial-run and full-run fixtures, with table-driven coverage
    per path-filter output and per failure mode.
  * AggregateCLITests — subprocess-level coverage of the script entrypoint,
    exit codes, and the no-raw-JSON guarantee.
"""

import json
import os
import re
import subprocess
import sys
import unittest
from pathlib import Path

# Make the script package importable as a plain module for the duration of
# this test file. Import errors during this step propagate normally with their
# original traceback so any breakage of the script is immediately diagnosable.
REPO = Path(__file__).resolve().parents[1]
WORKFLOW = REPO / ".github" / "workflows" / "ci.yml"
TURBO = REPO / "turbo.json"
SCRIPT = REPO / "scripts" / "check_ci_aggregate.py"
_SCRIPTS_DIR = str(REPO / "scripts")
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

import check_ci_aggregate as agg  # noqa: E402, I001  (direct import after sys.path)


# ---------------------------------------------------------------------------
# Independent routing oracle.
#
# Intentionally duplicated here rather than imported from the production
# script. If the production table changes by accident, this test-side oracle
# is what catches the regression.
# ---------------------------------------------------------------------------

BASE_OUTPUT_KEYS = (
    "full",
    "workflow",
    "backend",
    "telemetry",
    "mobile",
    "admin",
    "packages",
    "scripts",
    "docs",
)

ROUTE_TABLE = {
    "backend": ("backend", "scripts-python"),
    "telemetry": ("telemetry",),
    "mobile": ("mobile", "security"),
    "admin": ("admin", "audit", "security", "e2e"),
    "packages": ("mobile", "admin", "repo-assets"),
    "scripts": ("scripts-python", "audit"),
    "docs": ("docs-links",),
}

PATH_OUTPUT_KEYS = tuple(ROUTE_TABLE.keys())

FULL_JOB_NAMES = (
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
)


# ---------------------------------------------------------------------------
# Workflow YAML helpers (unchanged).
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Contract fixtures.
#
# These produce dicts shaped exactly like GitHub's ``toJson(needs)``. Every
# job entry retains the contract shape ``{ "result": ..., "outputs": {...} }``.
# ---------------------------------------------------------------------------


def _base_outputs(overrides=None):
    outputs = {k: "false" for k in BASE_OUTPUT_KEYS}
    if overrides:
        outputs.update(overrides)
    return outputs


def _realistic_partial_needs(active_outputs, overrides=None):
    """Realistic partial-run needs for a pull_request.

    ``changes`` is success and carries the active outputs. Every job in
    ``ROUTE_TABLE`` for an active output becomes ``success``; every other
    known job becomes ``skipped``. ``overrides`` lets a test flip a specific
    job to a different result while preserving the shape.
    """
    overrides = overrides or {}
    needs = {"changes": {"result": "success", "outputs": _base_outputs(active_outputs)}}
    expected = set()
    for key in active_outputs or {}:
        if active_outputs[key] == "true" and key in ROUTE_TABLE:
            expected.update(ROUTE_TABLE[key])
    for job in FULL_JOB_NAMES:
        result = overrides.get(job, "success" if job in expected else "skipped")
        needs[job] = {"result": result, "outputs": {}}
    return needs


def _realistic_full_needs(overrides=None):
    """Realistic full-mode needs for push/schedule (or pull_request with
    ``full==true`` / ``workflow==true``). All downstream jobs are expected to
    be ``success``. ``overrides`` lets a test flip a specific job. The event
    is supplied separately to ``_eval`` and the CLI environment.
    """
    overrides = overrides or {}
    outputs = _base_outputs({"full": "true"})
    needs = {"changes": {"result": "success", "outputs": outputs}}
    for job in FULL_JOB_NAMES:
        result = overrides.get(job, "success")
        needs[job] = {"result": result, "outputs": {}}
    return needs


def _flip(needs, job, result):
    clone = json.loads(json.dumps(needs))
    if job in clone:
        clone[job] = {"result": result, "outputs": clone[job].get("outputs", {})}
    return clone


# ---------------------------------------------------------------------------
# Workflow structure tests (unchanged).
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Behavior tests — driven by the realistic fixtures above.
# ---------------------------------------------------------------------------


class AggregateScriptTests(unittest.TestCase):
    def _eval(self, needs, event_name):
        return agg.evaluate(needs, event_name)

    def _expected_for(self, active_outputs):
        expected = set()
        for key, val in active_outputs.items():
            if val == "true" and key in ROUTE_TABLE:
                expected.update(ROUTE_TABLE[key])
        return expected

    # ---- baseline contract -------------------------------------------------

    def test_module_exposes_evaluate(self):
        self.assertTrue(callable(getattr(agg, "evaluate", None)))

    def test_empty_needs_fails(self):
        ok, reasons = self._eval({}, "push")
        self.assertFalse(ok)
        self.assertTrue(any("changes" in r or "missing" in r.lower() for r in reasons), reasons)

    def test_missing_changes_fails(self):
        needs = _realistic_partial_needs({})
        del needs["changes"]
        ok, reasons = self._eval(needs, "pull_request")
        self.assertFalse(ok)
        self.assertTrue(any("changes" in r or "missing" in r.lower() for r in reasons), reasons)

    def test_changes_failure_fails(self):
        needs = _realistic_full_needs()
        needs["changes"] = {"result": "failure", "outputs": needs["changes"]["outputs"]}
        ok, reasons = self._eval(needs, "push")
        self.assertFalse(ok)
        self.assertTrue(any("changes" in r for r in reasons), reasons)

    def test_unsupported_event_fails(self):
        needs = _realistic_full_needs()
        ok, reasons = self._eval(needs, "workflow_dispatch")
        self.assertFalse(ok)
        self.assertTrue(any("workflow_dispatch" in r or "event" in r for r in reasons), reasons)

    def test_missing_output_keys_fail(self):
        outputs = _base_outputs()
        del outputs["backend"]
        needs = {"changes": {"result": "success", "outputs": outputs}}
        for job in FULL_JOB_NAMES:
            needs[job] = {"result": "skipped", "outputs": {}}
        ok, reasons = self._eval(needs, "pull_request")
        self.assertFalse(ok)

    def test_invalid_output_values_fail(self):
        outputs = _base_outputs({"backend": "yes"})
        needs = {"changes": {"result": "success", "outputs": outputs}}
        for job in FULL_JOB_NAMES:
            needs[job] = {"result": "skipped", "outputs": {}}
        ok, reasons = self._eval(needs, "pull_request")
        self.assertFalse(ok)

    def test_malformed_outputs_fail(self):
        needs = {"changes": {"result": "success", "outputs": "not-a-dict"}}
        for job in FULL_JOB_NAMES:
            needs[job] = {"result": "skipped", "outputs": {}}
        ok, _ = self._eval(needs, "pull_request")
        self.assertFalse(ok)

    def test_malformed_job_entry_fails(self):
        needs = _realistic_partial_needs({"backend": "true"})
        needs["backend"] = "not-a-dict"
        ok, reasons = self._eval(needs, "pull_request")
        self.assertFalse(ok)
        self.assertTrue(any("backend" in r for r in reasons), reasons)

    def test_unknown_result_value_fails(self):
        needs = _realistic_full_needs(overrides={"backend": "weird"})
        ok, reasons = self._eval(needs, "push")
        self.assertFalse(ok)
        self.assertTrue(any("backend" in r for r in reasons), reasons)

    # ---- table-driven per-output path coverage -----------------------------

    def test_path_table_pass_for_each_output(self):
        for key in PATH_OUTPUT_KEYS:
            with self.subTest(output=key):
                outputs = {k: "false" for k in BASE_OUTPUT_KEYS}
                outputs[key] = "true"
                needs = _realistic_partial_needs(outputs)
                ok, reasons = self._eval(needs, "pull_request")
                self.assertTrue(ok, f"path={key} reasons={reasons}")
                expected = self._expected_for(outputs)
                self.assertTrue(expected, f"path={key} produced empty expected set")

    def test_path_table_skipped_expected_job_fails(self):
        for key in PATH_OUTPUT_KEYS:
            for job in ROUTE_TABLE[key]:
                with self.subTest(output=key, expected_job=job):
                    outputs = {k: "false" for k in BASE_OUTPUT_KEYS}
                    outputs[key] = "true"
                    needs = _realistic_partial_needs(outputs, overrides={job: "skipped"})
                    ok, reasons = self._eval(needs, "pull_request")
                    self.assertFalse(ok, f"path={key} job={job} skipped unexpectedly passed")
                    self.assertTrue(any(job in r for r in reasons), reasons)

    def test_path_table_failed_expected_job_fails(self):
        for key in PATH_OUTPUT_KEYS:
            for job in ROUTE_TABLE[key]:
                with self.subTest(output=key, expected_job=job):
                    outputs = {k: "false" for k in BASE_OUTPUT_KEYS}
                    outputs[key] = "true"
                    needs = _realistic_partial_needs(outputs, overrides={job: "failure"})
                    ok, reasons = self._eval(needs, "pull_request")
                    self.assertFalse(ok, f"path={key} job={job} failure unexpectedly passed")
                    self.assertTrue(any(job in r for r in reasons), reasons)

    def test_path_table_cancelled_expected_job_fails(self):
        for key in PATH_OUTPUT_KEYS:
            for job in ROUTE_TABLE[key]:
                with self.subTest(output=key, expected_job=job):
                    outputs = {k: "false" for k in BASE_OUTPUT_KEYS}
                    outputs[key] = "true"
                    needs = _realistic_partial_needs(outputs, overrides={job: "cancelled"})
                    ok, reasons = self._eval(needs, "pull_request")
                    self.assertFalse(ok, f"path={key} job={job} cancelled unexpectedly passed")
                    self.assertTrue(any(job in r for r in reasons), reasons)

    # ---- combined outputs ---------------------------------------------------

    def test_combined_backend_and_docs_pass(self):
        outputs = _base_outputs({"backend": "true", "docs": "true"})
        needs = _realistic_partial_needs(outputs)
        ok, reasons = self._eval(needs, "pull_request")
        self.assertTrue(ok, reasons)
        expected = self._expected_for(outputs)
        self.assertEqual(expected, {"backend", "scripts-python", "docs-links"})

    def test_combined_mobile_and_admin_pass(self):
        outputs = _base_outputs({"mobile": "true", "admin": "true"})
        needs = _realistic_partial_needs(outputs)
        ok, reasons = self._eval(needs, "pull_request")
        self.assertTrue(ok, reasons)
        expected = self._expected_for(outputs)
        self.assertEqual(expected, {"mobile", "security", "admin", "audit", "e2e"})

    def test_combined_packages_and_scripts_pass(self):
        outputs = _base_outputs({"packages": "true", "scripts": "true"})
        needs = _realistic_partial_needs(outputs)
        ok, reasons = self._eval(needs, "pull_request")
        self.assertTrue(ok, reasons)
        expected = self._expected_for(outputs)
        self.assertEqual(
            expected,
            {"mobile", "admin", "repo-assets", "scripts-python", "audit"},
        )

    def test_combined_backend_telemetry_docs_pass(self):
        outputs = _base_outputs({"backend": "true", "telemetry": "true", "docs": "true"})
        needs = _realistic_partial_needs(outputs)
        ok, reasons = self._eval(needs, "pull_request")
        self.assertTrue(ok, reasons)
        expected = self._expected_for(outputs)
        self.assertEqual(expected, {"backend", "scripts-python", "telemetry", "docs-links"})

    def test_combined_failure_in_union_fails(self):
        outputs = _base_outputs({"backend": "true", "docs": "true"})
        needs = _realistic_partial_needs(outputs, overrides={"docs-links": "failure"})
        ok, reasons = self._eval(needs, "pull_request")
        self.assertFalse(ok)
        self.assertTrue(any("docs-links" in r for r in reasons), reasons)

    # ---- full mode ----------------------------------------------------------

    def test_full_mode_pull_request_with_workflow_true_pass(self):
        outputs = _base_outputs({"workflow": "true"})
        needs = {"changes": {"result": "success", "outputs": outputs}}
        for job in FULL_JOB_NAMES:
            needs[job] = {"result": "success", "outputs": {}}
        ok, reasons = self._eval(needs, "pull_request")
        self.assertTrue(ok, reasons)

    def test_full_mode_pull_request_with_full_true_pass(self):
        outputs = _base_outputs({"full": "true"})
        needs = {"changes": {"result": "success", "outputs": outputs}}
        for job in FULL_JOB_NAMES:
            needs[job] = {"result": "success", "outputs": {}}
        ok, reasons = self._eval(needs, "pull_request")
        self.assertTrue(ok, reasons)

    def test_full_mode_push_with_full_true_pass(self):
        needs = _realistic_full_needs()
        ok, reasons = self._eval(needs, "push")
        self.assertTrue(ok, reasons)

    def test_full_mode_schedule_with_full_true_pass(self):
        needs = _realistic_full_needs()
        ok, reasons = self._eval(needs, "schedule")
        self.assertTrue(ok, reasons)

    def test_full_mode_push_without_full_fails(self):
        outputs = _base_outputs({"full": "false"})
        needs = {"changes": {"result": "success", "outputs": outputs}}
        for job in FULL_JOB_NAMES:
            needs[job] = {"result": "success", "outputs": {}}
        ok, reasons = self._eval(needs, "push")
        self.assertFalse(ok)
        self.assertTrue(any("full" in r for r in reasons), reasons)

    def test_full_mode_schedule_without_full_fails(self):
        outputs = _base_outputs({"full": "false"})
        needs = {"changes": {"result": "success", "outputs": outputs}}
        for job in FULL_JOB_NAMES:
            needs[job] = {"result": "success", "outputs": {}}
        ok, reasons = self._eval(needs, "schedule")
        self.assertFalse(ok)
        self.assertTrue(any("full" in r for r in reasons), reasons)

    def test_full_mode_each_job_skipped_fails(self):
        for job in FULL_JOB_NAMES:
            with self.subTest(job=job):
                needs = _realistic_full_needs(overrides={job: "skipped"})
                ok, reasons = self._eval(needs, "push")
                self.assertFalse(ok, f"job={job} skipped unexpectedly passed in full mode")
                self.assertTrue(any(job in r for r in reasons), reasons)

    def test_full_mode_each_job_failure_fails(self):
        for job in FULL_JOB_NAMES:
            with self.subTest(job=job):
                needs = _realistic_full_needs(overrides={job: "failure"})
                ok, reasons = self._eval(needs, "push")
                self.assertFalse(ok, f"job={job} failure unexpectedly passed in full mode")
                self.assertTrue(any(job in r for r in reasons), reasons)

    def test_full_mode_each_job_cancelled_fails(self):
        for job in FULL_JOB_NAMES:
            with self.subTest(job=job):
                needs = _realistic_full_needs(overrides={job: "cancelled"})
                ok, reasons = self._eval(needs, "push")
                self.assertFalse(ok, f"job={job} cancelled unexpectedly passed in full mode")
                self.assertTrue(any(job in r for r in reasons), reasons)

    # ---- unexpected job handling -------------------------------------------

    def test_unexpected_skipped_does_not_fail_partial_run(self):
        needs = _realistic_partial_needs({"backend": "true"})
        self.assertEqual(needs["trivy"]["result"], "skipped")
        ok, reasons = self._eval(needs, "pull_request")
        self.assertTrue(ok, reasons)

    def test_unexpected_success_does_not_create_false_failure(self):
        needs = _realistic_partial_needs(
            {"backend": "true"},
            overrides={"trivy": "success"},
        )
        self.assertEqual(needs["trivy"]["result"], "success")
        ok, reasons = self._eval(needs, "pull_request")
        self.assertTrue(ok, reasons)

    def test_unexpected_failure_fails(self):
        needs = _realistic_partial_needs({"backend": "true"}, overrides={"trivy": "failure"})
        ok, reasons = self._eval(needs, "pull_request")
        self.assertFalse(ok)
        self.assertTrue(any("trivy" in r for r in reasons), reasons)

    def test_unexpected_cancelled_fails(self):
        needs = _realistic_partial_needs({"backend": "true"}, overrides={"trivy": "cancelled"})
        ok, reasons = self._eval(needs, "pull_request")
        self.assertFalse(ok)
        self.assertTrue(any("trivy" in r for r in reasons), reasons)

    def test_missing_expected_job_fails(self):
        needs = _realistic_partial_needs({"backend": "true"})
        del needs["backend"]
        ok, reasons = self._eval(needs, "pull_request")
        self.assertFalse(ok)
        self.assertTrue(any("backend" in r or "missing" in r.lower() for r in reasons), reasons)

    # ---- scripts-only regression (audit routing fix) ----------------------

    def test_scripts_only_admin_skipped_audit_success_pass(self):
        needs = _realistic_partial_needs({"scripts": "true"})
        ok, reasons = self._eval(needs, "pull_request")
        self.assertTrue(ok, reasons)

    def test_scripts_only_audit_skipped_fails(self):
        needs = _realistic_partial_needs({"scripts": "true"}, overrides={"audit": "skipped"})
        ok, reasons = self._eval(needs, "pull_request")
        self.assertFalse(ok)
        self.assertTrue(any("audit" in r for r in reasons), reasons)


# ---------------------------------------------------------------------------
# CLI subprocess tests — drive the script as a real entrypoint.
# ---------------------------------------------------------------------------


class AggregateCLITests(unittest.TestCase):
    _CI_ENV_VARS = ("CI_NEEDS_JSON", "CI_EVENT_NAME")

    def _run(self, env):
        proc = subprocess.run(
            [sys.executable, str(SCRIPT)],
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        return proc

    def _env(self, needs=None, event=None, needs_json=None):
        env = {k: v for k, v in os.environ.items() if k not in self._CI_ENV_VARS}
        if needs_json is not None:
            env["CI_NEEDS_JSON"] = needs_json
        elif needs is not None:
            env["CI_NEEDS_JSON"] = json.dumps(needs)
        if event is not None:
            env["CI_EVENT_NAME"] = event
        return env

    def test_cli_passing_payload_returns_zero(self):
        needs = _realistic_full_needs()
        proc = self._run(self._env(needs, "push"))
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)

    def test_cli_failing_payload_returns_nonzero(self):
        needs = _realistic_full_needs(overrides={"backend": "failure"})
        proc = self._run(self._env(needs, "push"))
        self.assertNotEqual(proc.returncode, 0)
        out = (proc.stdout or "") + (proc.stderr or "")
        self.assertTrue(any("backend" in line for line in out.splitlines()), out)

    def test_cli_missing_ci_needs_json_returns_nonzero(self):
        env = self._env(event="push")
        self.assertNotIn("CI_NEEDS_JSON", env)
        proc = self._run(env)
        self.assertNotEqual(proc.returncode, 0)

    def test_cli_invalid_json_returns_nonzero(self):
        env = self._env(needs_json="{not-json", event="push")
        proc = self._run(env)
        self.assertNotEqual(proc.returncode, 0)

    def test_cli_unsupported_event_returns_nonzero(self):
        needs = _realistic_full_needs()
        proc = self._run(self._env(needs, "workflow_dispatch"))
        self.assertNotEqual(proc.returncode, 0)

    def test_cli_output_never_leaks_raw_json(self):
        needs = _realistic_partial_needs({"backend": "true", "docs": "true"})
        proc = self._run(self._env(needs, "pull_request"))
        out = (proc.stdout or "") + (proc.stderr or "")
        for needle in (json.dumps(needs), '"outputs"', '"result"', '"contexts"'):
            self.assertNotIn(needle, out, f"script leaked JSON-like content: {needle}")

    def test_cli_output_never_leaks_raw_json_on_failure(self):
        needs = _realistic_full_needs(overrides={"backend": "failure"})
        proc = self._run(self._env(needs, "push"))
        out = (proc.stdout or "") + (proc.stderr or "")
        for needle in (json.dumps(needs), '"outputs"', '"contexts"', '"checks"'):
            self.assertNotIn(needle, out, f"script leaked JSON-like content on failure: {needle}")


if __name__ == "__main__":
    unittest.main()
