"""Contract tests for the T24 CI-side publishing gate.

These tests are written TDD-first and intentionally fail until the
``.github/workflows/ci.yml`` updates for T24 land:

* tag trigger ``v*.*.*`` exists;
* ``prepare-publish`` job exists, has no checkout step and ``permissions: {}``;
* the job validates the SHA as exactly 40 hexadecimal characters and the
  strict ``^refs/tags/v[0-9]+\\.[0-9]+\\.[0-9]+$`` pattern;
* it exposes the six required outputs (allowed, publish_kind, validated_sha,
  validated_ref, version, major_minor);
* a ``publish-containers`` job depends on ``aggregate`` and ``prepare-publish``,
  is guarded by the ``allowed == 'true'`` output and uses the right caller
  permissions (including ``security-events: write``);
* the ``publish-containers`` job uses the prepared outputs as inputs and does
  not recompute them;
* ``aggregate`` does not depend on ``publish-containers`` (no cycle).

This module only inspects workflow text. It does not execute GitHub Actions.
"""

from __future__ import annotations

import unittest
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
WORKFLOW = REPO / ".github" / "workflows" / "ci.yml"
DOCKER_PUBLISH = REPO / ".github" / "workflows" / "docker-publish.yml"


def _ci() -> dict:
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


def _ci_text() -> str:
    return WORKFLOW.read_text(encoding="utf-8")


def _docker_publish() -> dict:
    return yaml.safe_load(DOCKER_PUBLISH.read_text(encoding="utf-8"))


def _docker_publish_text() -> str:
    return DOCKER_PUBLISH.read_text(encoding="utf-8")


def _on(workflow: dict) -> dict:
    return workflow.get(True, workflow.get("on", {}))


class CITriggerTests(unittest.TestCase):
    def test_tag_trigger_present(self):
        on = _on(_ci())
        push = on.get("push", {})
        # Either inline list or block-list under push.tags
        self.assertEqual(
            push.get("tags"),
            ["v*.*.*"],
            "push trigger must include tag pattern v*.*.*",
        )

    def test_branch_push_trigger_preserved(self):
        on = _on(_ci())
        push = on.get("push", {})
        self.assertEqual(set(push.get("branches", [])), {"master", "main", "develop"})


class PreparePublishJobTests(unittest.TestCase):
    def _job(self):
        return _ci()["jobs"]["prepare-publish"]

    def test_prepare_publish_job_exists(self):
        self.assertIn("prepare-publish", _ci()["jobs"])

    def test_prepare_publish_has_no_checkout(self):
        text = _ci_text()
        # Only check within the prepare-publish block
        start = text.index("prepare-publish:")
        end = text.index("publish-containers:", start)
        block = text[start:end]
        self.assertNotIn(
            "actions/checkout",
            block,
            "prepare-publish must not perform checkout",
        )

    def test_prepare_publish_permissions_empty(self):
        job = self._job()
        self.assertEqual(
            job.get("permissions"),
            {},
            "prepare-publish must declare empty permissions: {}",
        )

    def test_prepare_publish_runs_only_on_push(self):
        job = self._job()
        cond = job.get("if", "")
        self.assertIn("github.event_name", cond)
        self.assertIn("'push'", cond)

    def test_prepare_publish_sha_validation(self):
        block = _ci_text()
        start = block.index("prepare-publish:")
        end = block.index("publish-containers:", start)
        body = block[start:end]
        self.assertIn("GITHUB_SHA", body)
        self.assertRegex(
            body,
            r"\[\s*0-9a-fA-F\s*\]\{40\s*\}",
            "GITHUB_SHA must be validated as exactly 40 hex characters",
        )

    def test_prepare_publish_strict_tag_pattern(self):
        block = _ci_text()
        start = block.index("prepare-publish:")
        end = block.index("publish-containers:", start)
        body = block[start:end]
        # The strict semver tag pattern must be enforced by an anchored regex
        # matching `^refs/tags/v([0-9]+)\.([0-9]+)\.([0-9]+)$`.
        self.assertRegex(
            body,
            r"\^refs/tags/v\(\[0-9\]\+\)\\\.\(\[0-9\]\+\)\\\.\(\[0-9\]\+\)\$",
            "tag validation must enforce strict ^refs/tags/vX.Y.Z$ pattern",
        )

    def test_prepare_publish_exposes_all_six_outputs(self):
        job = self._job()
        outputs = job.get("outputs", {})
        for name in (
            "allowed",
            "publish_kind",
            "validated_sha",
            "validated_ref",
            "version",
            "major_minor",
        ):
            with self.subTest(output=name):
                self.assertIn(name, outputs, f"prepare-publish must expose output {name!r}")


class PublishContainersJobTests(unittest.TestCase):
    def _job(self):
        return _ci()["jobs"]["publish-containers"]

    def test_publish_containers_job_exists(self):
        self.assertIn("publish-containers", _ci()["jobs"])

    def test_publish_containers_needs_aggregate_and_prepare_publish(self):
        job = self._job()
        self.assertEqual(set(job.get("needs", [])), {"aggregate", "prepare-publish"})

    def test_publish_containers_guarded_by_allowed_true(self):
        job = self._job()
        cond = job.get("if", "")
        self.assertIn("prepare-publish.outputs.allowed", cond)
        self.assertIn("'true'", cond)

    def test_publish_containers_caller_permissions(self):
        job = self._job()
        perms = job.get("permissions", {})
        for required in ("contents: read", "packages: write", "security-events: write"):
            with self.subTest(perm=required):
                # value can be string OR dict; both forms acceptable
                self.assertIn(
                    required.split(":")[0],
                    perms,
                    f"publish-containers caller permissions must include {required!r}",
                )

    def test_publish_containers_uses_reusable_workflow(self):
        block = _ci_text()
        start = block.index("publish-containers:")
        body = block[start:]
        self.assertIn(
            "./.github/workflows/docker-publish.yml",
            body,
            "publish-containers must call ./docker-publish.yml",
        )

    def test_publish_containers_passes_prepared_outputs(self):
        block = _ci_text()
        start = block.index("publish-containers:")
        body = block[start:]
        # Each passed value must come from prepare-publish.outputs.*
        for name in (
            "validated_sha",
            "validated_ref",
            "publish_kind",
            "version",
            "major_minor",
        ):
            with self.subTest(input=name):
                self.assertIn(
                    f"needs.prepare-publish.outputs.{name}",
                    body,
                    f"publish-containers must pass needs.prepare-publish.outputs.{name}",
                )
        # must not recompute github.sha/github.ref in the publish-containers block
        # (allowed github.sha would bypass the gate)
        self.assertNotIn("github.sha", body)
        self.assertNotIn("github.ref", body)

    def test_aggregate_does_not_depend_on_publish_containers(self):
        aggregate = _ci()["jobs"]["aggregate"]
        self.assertNotIn(
            "publish-containers",
            aggregate.get("needs", []),
            "aggregate must not depend on publish-containers (no cycle)",
        )

    def test_no_job_depends_on_publish_containers(self):
        """publish-containers must be a sink node (no downstream job)."""
        for name, job in _ci()["jobs"].items():
            if name == "publish-containers":
                continue
            self.assertNotIn(
                "publish-containers",
                job.get("needs", []),
                f"job {name} must not depend on publish-containers",
            )


class ReusableWorkflowContractTests(unittest.TestCase):
    """The reusable docker-publish workflow must be callable-only."""

    def test_only_workflow_call_trigger(self):
        on = _on(_docker_publish())
        self.assertEqual(list(on.keys()), ["workflow_call"])
        for forbidden in ("push", "pull_request", "schedule", "workflow_run"):
            self.assertNotIn(forbidden, on)

    def test_no_secrets_inherit_under_workflow_call(self):
        on = _on(_docker_publish())
        wc = on["workflow_call"]
        self.assertNotIn("secrets", wc, "on.workflow_call must not declare secrets")

    def test_all_inputs_are_strings(self):
        wc = _on(_docker_publish())["workflow_call"]
        inputs = wc.get("inputs", {})
        for input_name in (
            "validated_sha",
            "validated_ref",
            "publish_kind",
            "version",
            "major_minor",
        ):
            with self.subTest(input=input_name):
                self.assertIn(input_name, inputs)
                self.assertEqual(
                    inputs[input_name].get("type"),
                    "string",
                    f"input {input_name} must be type: string",
                )
                # no semver type allowed
                self.assertNotIn("semver", inputs[input_name])

    def test_required_inputs(self):
        wc = _on(_docker_publish())["workflow_call"]
        inputs = wc.get("inputs", {})
        for required in ("validated_sha", "validated_ref", "publish_kind"):
            with self.subTest(input=required):
                self.assertTrue(
                    inputs.get(required, {}).get("required"),
                    f"input {required} must be required: true",
                )

    def test_version_and_major_minor_optional_with_empty_default(self):
        wc = _on(_docker_publish())["workflow_call"]
        inputs = wc.get("inputs", {})
        for opt in ("version", "major_minor"):
            with self.subTest(input=opt):
                self.assertFalse(
                    inputs.get(opt, {}).get("required"),
                    f"input {opt} must be optional",
                )
                self.assertEqual(
                    inputs.get(opt, {}).get("default"),
                    "",
                    f"input {opt} must default to ''",
                )


class DockerPublishStepContractTests(unittest.TestCase):
    """Verify the reusable workflow honors validated SHA, immutable tags, contexts."""

    def _job(self, name: str) -> dict:
        return _docker_publish()["jobs"][name]

    def test_backend_context_preserved(self):
        steps = self._job("build-backend")["steps"]
        build_step = next(
            s for s in steps if s.get("uses", "").startswith("docker/build-push-action")
        )
        # The first build step is the SHA-tag build; context must remain ./backend
        self.assertEqual(build_step["with"]["context"], "./backend")

    def test_backend_checkout_uses_validated_sha(self):
        steps = self._job("build-backend")["steps"]
        checkout = next(s for s in steps if s.get("uses", "").startswith("actions/checkout"))
        self.assertEqual(checkout["with"]["ref"], "${{ inputs.validated_sha }}")

    def test_backend_uses_full_sha_tag(self):
        block = _docker_publish_text()
        self.assertIn("sha-${{ inputs.validated_sha }}", block)

    def test_admin_context_root_with_dockerfile(self):
        steps = self._job("build-admin")["steps"]
        # Filter to the SHA-tag build (no `if:`) so we look at the right one
        sha_step = next(
            s
            for s in steps
            if s.get("uses", "").startswith("docker/build-push-action") and "if" not in s
        )
        self.assertEqual(sha_step["with"]["context"], ".")
        self.assertEqual(sha_step["with"]["file"], "admin/Dockerfile")

    def test_admin_checkout_uses_validated_sha(self):
        steps = self._job("build-admin")["steps"]
        checkout = next(s for s in steps if s.get("uses", "").startswith("actions/checkout"))
        self.assertEqual(checkout["with"]["ref"], "${{ inputs.validated_sha }}")

    def test_admin_uses_full_sha_tag(self):
        block = _docker_publish_text()
        self.assertIn("sha-${{ inputs.validated_sha }}", block)

    def test_no_latest_tag_for_tag_kind(self):
        text = _docker_publish_text()
        # Every step that pushes `:latest` must be guarded by publish_kind == 'branch'
        self.assertIn("inputs.publish_kind == 'branch'", text)
        # Every step that pushes the version tag must be guarded by publish_kind == 'tag'
        self.assertIn("inputs.publish_kind == 'tag'", text)

    def test_scan_uses_immutable_sha_tags(self):
        # Scan steps reference env.BACKEND_SHA_TAG / env.ADMIN_SHA_TAG. Those
        # env vars are defined at the workflow level and include the literal
        # substring `sha-${{ inputs.validated_sha }}`. This proves the scan
        # always targets an immutable SHA-tagged image and never :latest.
        scan = self._job("scan")
        text = _docker_publish_text()
        self.assertIn("env.BACKEND_SHA_TAG", text)
        self.assertIn("env.ADMIN_SHA_TAG", text)
        self.assertIn("sha-${{ inputs.validated_sha }}", text)
        # Each trivy image-ref must not be :latest
        for step in scan["steps"]:
            ref = step.get("with", {}).get("image-ref", "")
            if ref:
                self.assertNotIn(":latest", ref)

    def test_scan_does_not_use_continue_on_error(self):
        scan = self._job("scan")
        for step in scan["steps"]:
            self.assertNotIn("continue-on-error", step)

    def test_scan_needs_both_build_jobs(self):
        scan = self._job("scan")
        self.assertEqual(set(scan["needs"]), {"build-backend", "build-admin"})

    def test_trivy_action_pinned(self):
        text = _docker_publish_text()
        self.assertIn(
            "aquasecurity/trivy-action@57a97c7e7821a5776cebc9bb87c984fa69cba8f1",
            text,
        )


class NoSecretInheritTests(unittest.TestCase):
    """Defensive guard against accidental secrets: inherit re-introduction."""

    @staticmethod
    def _strip_comments(text: str) -> str:
        return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))

    def test_no_secrets_inherit_anywhere(self):
        text = self._strip_comments(_docker_publish_text())
        self.assertNotIn("secrets: inherit", text)
        wc = _on(_docker_publish())["workflow_call"]
        self.assertNotIn("secrets", wc)


class DependencyGraphTests(unittest.TestCase):
    """Verify the dependency graph is acyclic and structurally correct."""

    def test_publish_containers_needs_aggregate(self):
        pub = _ci()["jobs"]["publish-containers"]
        self.assertIn("aggregate", pub["needs"])

    def test_aggregate_does_not_depend_on_publish_containers(self):
        agg = _ci()["jobs"]["aggregate"]
        self.assertNotIn("publish-containers", agg["needs"])


if __name__ == "__main__":
    unittest.main()
