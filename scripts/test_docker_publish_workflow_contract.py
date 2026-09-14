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
        text = self._strip_comments(_text())
        # metadata-action is allowed (we use it for raw tags); semver inference is not.
        self.assertNotIn("type=semver", text)

        wf = _wf()
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

    def _build_push_steps(self, name: str) -> list[dict]:
        return [
            step
            for step in self._job(name)["steps"]
            if isinstance(step, dict)
            and step.get("uses", "").startswith("docker/build-push-action")
        ]

    def _metadata_step(self, name: str) -> dict:
        return next(
            s
            for s in self._job(name)["steps"]
            if isinstance(s, dict) and s.get("uses", "").startswith("docker/metadata-action")
        )

    # ---- exactly one build-push-action call per image ------------------

    def test_backend_single_build_push_action(self):
        self.assertEqual(
            len(self._build_push_steps("build-backend")),
            1,
            "build-backend must invoke docker/build-push-action exactly once",
        )

    def test_admin_single_build_push_action(self):
        self.assertEqual(
            len(self._build_push_steps("build-admin")),
            1,
            "build-admin must invoke docker/build-push-action exactly once",
        )

    # ---- backend ----------------------------------------------------------

    def test_backend_context_preserved(self):
        step = self._build_push_steps("build-backend")[0]
        self.assertEqual(step["with"]["context"], "./backend")

    def test_backend_checkout_uses_validated_sha(self):
        steps = self._job("build-backend")["steps"]
        checkout = next(s for s in steps if s.get("uses", "").startswith("actions/checkout"))
        self.assertEqual(checkout["with"]["ref"], "${{ inputs.validated_sha }}")

    def test_backend_uses_full_sha_tag(self):
        text = _text()
        self.assertIn("sha-${{ inputs.validated_sha }}", text)

    def test_backend_metadata_declares_sha_tag(self):
        meta = self._metadata_step("build-backend")
        self.assertIn("sha-${{ inputs.validated_sha }}", meta["with"]["tags"])

    def test_backend_metadata_declares_latest_tag_with_branch_guard(self):
        meta = self._metadata_step("build-backend")
        self.assertIn("latest", meta["with"]["tags"])
        self.assertIn("publish_kind == 'branch'", meta["with"]["tags"])

    def test_backend_metadata_declares_version_tag_with_tag_guard(self):
        meta = self._metadata_step("build-backend")
        self.assertIn("inputs.version", meta["with"]["tags"])
        self.assertIn("publish_kind == 'tag'", meta["with"]["tags"])

    def test_backend_metadata_declares_major_minor_tag_with_tag_guard(self):
        meta = self._metadata_step("build-backend")
        self.assertIn("inputs.major_minor", meta["with"]["tags"])
        self.assertIn("publish_kind == 'tag'", meta["with"]["tags"])

    def test_backend_metadata_uses_only_raw_type(self):
        meta = self._metadata_step("build-backend")
        tags = meta["with"]["tags"]
        self.assertNotIn("type=semver", tags)
        # Every tag line should use type=raw
        for line in tags.splitlines():
            if line.strip():
                self.assertIn("type=raw", line, f"tag line must be raw: {line!r}")

    def test_backend_build_step_has_cache_to(self):
        step = self._build_push_steps("build-backend")[0]
        self.assertEqual(step["with"]["cache-from"], "type=gha")
        self.assertEqual(step["with"]["cache-to"], "type=gha,mode=max")

    def test_backend_build_step_has_labels(self):
        step = self._build_push_steps("build-backend")[0]
        self.assertIn("labels", step["with"])

    # ---- admin ------------------------------------------------------------

    def test_admin_context_is_root(self):
        step = self._build_push_steps("build-admin")[0]
        self.assertEqual(step["with"]["context"], ".")

    def test_admin_uses_admin_dockerfile(self):
        step = self._build_push_steps("build-admin")[0]
        self.assertEqual(step["with"]["file"], "admin/Dockerfile")

    def test_admin_checkout_uses_validated_sha(self):
        steps = self._job("build-admin")["steps"]
        checkout = next(s for s in steps if s.get("uses", "").startswith("actions/checkout"))
        self.assertEqual(checkout["with"]["ref"], "${{ inputs.validated_sha }}")

    def test_admin_uses_full_sha_tag(self):
        text = _text()
        self.assertIn("sha-${{ inputs.validated_sha }}", text)

    def test_admin_metadata_declares_sha_tag(self):
        meta = self._metadata_step("build-admin")
        self.assertIn("sha-${{ inputs.validated_sha }}", meta["with"]["tags"])

    def test_admin_metadata_declares_latest_tag_with_branch_guard(self):
        meta = self._metadata_step("build-admin")
        self.assertIn("latest", meta["with"]["tags"])
        self.assertIn("publish_kind == 'branch'", meta["with"]["tags"])

    def test_admin_metadata_declares_version_tag_with_tag_guard(self):
        meta = self._metadata_step("build-admin")
        self.assertIn("inputs.version", meta["with"]["tags"])
        self.assertIn("publish_kind == 'tag'", meta["with"]["tags"])

    def test_admin_metadata_does_not_include_major_minor(self):
        meta = self._metadata_step("build-admin")
        self.assertNotIn("inputs.major_minor", meta["with"]["tags"])

    def test_admin_build_step_has_cache_to(self):
        step = self._build_push_steps("build-admin")[0]
        self.assertEqual(step["with"]["cache-from"], "type=gha")
        self.assertEqual(step["with"]["cache-to"], "type=gha,mode=max")

    def test_admin_build_step_has_labels(self):
        step = self._build_push_steps("build-admin")[0]
        self.assertIn("labels", step["with"])


class WorkflowEnvContractTests(unittest.TestCase):
    """Workflow-level env must not declare same-level self-references."""

    def test_no_sha_tag_env_keys(self):
        env = _wf().get("env", {})
        for key in env:
            self.assertNotIn(
                "SHA_TAG",
                key,
                f"env key {key!r} is a same-level SHA-tag fragment; inline at consumption",
            )

    def test_no_same_level_env_self_reference(self):
        """No env key value should reference another env key declared at the
        same workflow-level env mapping. Inline expansion at the consumption
        site is the only allowed pattern."""
        env = _wf().get("env", {})
        for key, value in env.items():
            self.assertNotIn(
                "env.",
                str(value),
                f"env key {key!r} depends on another env key: {value!r}",
            )


class ScanContractTests(unittest.TestCase):
    def _job(self) -> dict:
        return _wf()["jobs"]["scan"]

    def test_scan_needs_both_build_jobs(self):
        self.assertEqual(set(self._job()["needs"]), {"build-backend", "build-admin"})

    def test_scan_uses_immutable_sha_tags(self):
        for step in self._job()["steps"]:
            ref = step.get("with", {}).get("image-ref", "")
            if ref:
                self.assertIn(
                    "inputs.validated_sha", ref, f"scan must reference validated_sha, got {ref}"
                )
                self.assertNotIn(":latest", ref)

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
        # The caller is a job-level reusable-workflow invocation: `uses` lives
        # on the job, and inputs live under `with`.
        self.assertEqual(
            pub.get("uses"),
            "./.github/workflows/docker-publish.yml",
        )
        self.assertIn("with", pub)
        with_inputs = pub["with"]
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
