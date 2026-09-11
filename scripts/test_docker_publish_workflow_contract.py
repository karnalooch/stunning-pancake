"""Contract tests for the T24 reusable ``docker-publish.yml`` workflow.

These tests are written TDD-first and intentionally fail until the
``docker-publish.yml`` is converted to a callable-only reusable workflow
with the exact input contract required by T24.
"""

from __future__ import annotations

import unittest
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
WORKFLOW = REPO / ".github" / "workflows" / "docker-publish.yml"
CI_WORKFLOW = REPO / ".github" / "workflows" / "ci.yml"


def _wf():
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


def _text() -> str:
    return WORKFLOW.read_text(encoding="utf-8")


def _ci() -> dict:
    return yaml.safe_load(CI_WORKFLOW.read_text(encoding="utf-8"))


def _ci_text() -> str:
    return CI_WORKFLOW.read_text(encoding="utf-8")


def _on(workflow: dict) -> dict:
    return workflow.get(True, workflow.get("on", {}))


class CallableOnlyTests(unittest.TestCase):
    def test_workflow_call_only(self):
        on = _on(_wf())
        self.assertEqual(list(on.keys()), ["workflow_call"])
        for forbidden in ("push", "pull_request", "schedule", "workflow_run"):
            self.assertNotIn(forbidden, on)

    def test_no_secrets_under_workflow_call(self):
        on = _on(_wf())
        wc = on["workflow_call"]
        self.assertNotIn("secrets", wc)

    @staticmethod
    def _strip_comments(text: str) -> str:
        return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))

    def test_no_metadata_action_or_semver_inference(self):
        # metadata-action and semver inference must not appear anywhere in the
        # workflow (excluding comments). github.ref / github.sha must not be
        # used in any step value (we only check steps + workflow_call, not
        # free-form comments which legitimately mention those names).
        text = self._strip_comments(_text())
        self.assertNotIn("docker/metadata-action", text)
        self.assertNotIn("type=semver", text)

        wf = _wf()
        # Inputs description may mention `github.ref` in prose, but no step
        # should actually reference `github.ref` or `github.sha`.
        for job in wf["jobs"].values():
            for step in job.get("steps", []):
                step_text = str(step)
                self.assertNotIn("github.ref", step_text, f"step references github.ref: {step}")
                self.assertNotIn("github.sha", step_text, f"step references github.sha: {step}")


class InputContractTests(unittest.TestCase):
    def _inputs(self) -> dict:
        return _on(_wf())["workflow_call"]["inputs"]

    def test_required_inputs_declared(self):
        inputs = self._inputs()
        for name in ("validated_sha", "validated_ref", "publish_kind"):
            with self.subTest(input=name):
                self.assertIn(name, inputs)
                self.assertTrue(inputs[name].get("required"))
                self.assertEqual(inputs[name].get("type"), "string")

    def test_optional_inputs_declared(self):
        inputs = self._inputs()
        for name in ("version", "major_minor"):
            with self.subTest(input=name):
                self.assertIn(name, inputs)
                self.assertFalse(inputs[name].get("required"))
                self.assertEqual(inputs[name].get("type"), "string")
                self.assertEqual(inputs[name].get("default"), "")

    def test_no_extra_inputs(self):
        declared = set(self._inputs().keys())
        expected = {"validated_sha", "validated_ref", "publish_kind", "version", "major_minor"}
        self.assertEqual(declared, expected)


class BuildJobContractTests(unittest.TestCase):
    def _job(self, name: str) -> dict:
        return _wf()["jobs"][name]

    # ---- backend ----------------------------------------------------------

    def test_backend_context_preserved(self):
        steps = self._job("build-backend")["steps"]
        sha_step = next(
            s
            for s in steps
            if s.get("uses", "").startswith("docker/build-push-action") and "if" not in s
        )
        self.assertEqual(sha_step["with"]["context"], "./backend")

    def test_backend_checkout_uses_validated_sha(self):
        steps = self._job("build-backend")["steps"]
        checkout = next(s for s in steps if s.get("uses", "").startswith("actions/checkout"))
        self.assertEqual(checkout["with"]["ref"], "${{ inputs.validated_sha }}")

    def test_backend_uses_full_sha_tag(self):
        text = _text()
        self.assertIn("sha-${{ inputs.validated_sha }}", text)

    def test_backend_push_always(self):
        for step in self._job("build-backend")["steps"]:
            if step.get("uses", "").startswith("docker/build-push-action"):
                self.assertTrue(step["with"].get("push"))

    # ---- admin ------------------------------------------------------------

    def test_admin_context_is_root(self):
        steps = self._job("build-admin")["steps"]
        sha_step = next(
            s
            for s in steps
            if s.get("uses", "").startswith("docker/build-push-action") and "if" not in s
        )
        self.assertEqual(sha_step["with"]["context"], ".")

    def test_admin_uses_admin_dockerfile(self):
        steps = self._job("build-admin")["steps"]
        sha_step = next(
            s
            for s in steps
            if s.get("uses", "").startswith("docker/build-push-action") and "if" not in s
        )
        self.assertEqual(sha_step["with"]["file"], "admin/Dockerfile")

    def test_admin_checkout_uses_validated_sha(self):
        steps = self._job("build-admin")["steps"]
        checkout = next(s for s in steps if s.get("uses", "").startswith("actions/checkout"))
        self.assertEqual(checkout["with"]["ref"], "${{ inputs.validated_sha }}")

    def test_admin_uses_full_sha_tag(self):
        text = _text()
        self.assertIn("sha-${{ inputs.validated_sha }}", text)

    def test_admin_push_always(self):
        for step in self._job("build-admin")["steps"]:
            if step.get("uses", "").startswith("docker/build-push-action"):
                self.assertTrue(step["with"].get("push"))


class TagKindContractTests(unittest.TestCase):
    """Tags must be branched by ``publish_kind`` (branch vs tag)."""

    def _steps_by_uses(self, job_name: str):
        return _wf()["jobs"][job_name]["steps"]

    def _latest_step(self, job_name: str):
        # step whose name contains "latest"
        for step in self._steps_by_uses(job_name):
            if "latest" in step.get("name", ""):
                return step
        self.fail(f"no latest tag step found in {job_name}")

    def _version_step(self, job_name: str):
        # step that pushes ${{ inputs.version }}
        for step in self._steps_by_uses(job_name):
            if "inputs.version" in (
                step.get("name", "") + str(step.get("with", {}).get("tags", ""))
            ):
                return step
        self.fail(f"no version tag step found in {job_name}")

    def test_backend_latest_step_guarded_by_branch(self):
        step = self._latest_step("build-backend")
        self.assertEqual(step.get("if"), "inputs.publish_kind == 'branch'")

    def test_backend_version_step_guarded_by_tag(self):
        step = self._version_step("build-backend")
        self.assertEqual(step.get("if"), "inputs.publish_kind == 'tag'")

    def test_admin_latest_step_guarded_by_branch(self):
        step = self._latest_step("build-admin")
        self.assertEqual(step.get("if"), "inputs.publish_kind == 'branch'")

    def test_admin_version_step_guarded_by_tag(self):
        step = self._version_step("build-admin")
        self.assertEqual(step.get("if"), "inputs.publish_kind == 'tag'")

    def test_no_unconditional_latest(self):
        text = _text()
        self.assertIn("inputs.publish_kind == 'branch'", text)
        self.assertIn("inputs.publish_kind == 'tag'", text)


class ScanContractTests(unittest.TestCase):
    def _job(self) -> dict:
        return _wf()["jobs"]["scan"]

    def test_scan_needs_both_build_jobs(self):
        self.assertEqual(set(self._job()["needs"]), {"build-backend", "build-admin"})

    def test_scan_uses_immutable_sha_tags(self):
        # Scan steps reference env.BACKEND_SHA_TAG / env.ADMIN_SHA_TAG. Those
        # env vars are defined at the workflow level and include the literal
        # substring `sha-${{ inputs.validated_sha }}`. This proves the scan
        # always targets an immutable SHA-tagged image and never :latest.
        text = _text()
        self.assertIn("env.BACKEND_SHA_TAG", text)
        self.assertIn("env.ADMIN_SHA_TAG", text)
        self.assertIn("sha-${{ inputs.validated_sha }}", text)

    def test_scan_never_scans_latest(self):
        for step in self._job()["steps"]:
            ref = step.get("with", {}).get("image-ref", "")
            if ref:
                self.assertNotIn(":latest", ref)

    def test_trivy_action_pinned(self):
        text = _text()
        self.assertIn(
            "aquasecurity/trivy-action@57a97c7e7821a5776cebc9bb87c984fa69cba8f1",
            text,
        )

    def test_scan_no_continue_on_error(self):
        for step in self._job()["steps"]:
            self.assertNotIn("continue-on-error", step)

    def test_sarif_categories_preserved(self):
        text = _text()
        self.assertIn("category: trivy-backend", text)
        self.assertIn("category: trivy-admin", text)


class PRTriggerSafetyTests(unittest.TestCase):
    """PRs and other unsupported events must not publish anything."""

    def test_no_push_trigger_in_docker_publish(self):
        on = _on(_wf())
        for forbidden in ("push", "pull_request", "schedule", "workflow_run"):
            self.assertNotIn(forbidden, on)

    def test_ci_workflow_caller_passes_validated_outputs(self):
        pub = _ci()["jobs"]["publish-containers"]
        # The job calls the reusable workflow as a `uses:` step
        call_steps = [
            s for s in pub["steps"] if s.get("uses") == "./.github/workflows/docker-publish.yml"
        ]
        self.assertEqual(
            len(call_steps), 1, "publish-containers must call the reusable workflow exactly once"
        )
        call = call_steps[0]
        self.assertIn("with", call, "caller must use `with:` to pass inputs")
        with_inputs = call["with"]
        for input_name in (
            "validated_sha",
            "validated_ref",
            "publish_kind",
            "version",
            "major_minor",
        ):
            with self.subTest(input=input_name):
                self.assertIn(
                    input_name,
                    with_inputs,
                    f"publish-containers must pass {input_name}",
                )


if __name__ == "__main__":
    unittest.main()
