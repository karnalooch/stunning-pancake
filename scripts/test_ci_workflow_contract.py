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
* the ``publish-containers`` job is a job-level reusable-workflow call:
  ``uses`` is set directly on the job, ``runs-on`` is absent, ``steps`` is
  absent, and ``with`` lives directly on the job; all five inputs reference
  ``needs.prepare-publish.outputs.*``;
* ``aggregate`` does not depend on ``publish-containers`` (no cycle);
* the existing ``admin`` CI job runs a blocking PR-safe Admin Buildx
  validation step (context = repo root, file = admin/Dockerfile, scoped GHA
  layer cache, no push and no GHCR login);
* pnpm's setup-node cache key is explicitly bound to the root lockfile.

This module parses the workflow as YAML and inspects the parsed structure.
"""

from __future__ import annotations

import unittest
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
WORKFLOW = REPO / ".github" / "workflows" / "ci.yml"
DOCKER_PUBLISH = REPO / ".github" / "workflows" / "docker-publish.yml"
PNPM_SETUP = REPO / ".github" / "actions" / "pnpm-setup" / "action.yml"


def _ci() -> dict:
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


def _ci_text() -> str:
    return WORKFLOW.read_text(encoding="utf-8")


def _docker_publish() -> dict:
    return yaml.safe_load(DOCKER_PUBLISH.read_text(encoding="utf-8"))


def _docker_publish_text() -> str:
    return DOCKER_PUBLISH.read_text(encoding="utf-8")


def _pnpm_setup() -> dict:
    return yaml.safe_load(PNPM_SETUP.read_text(encoding="utf-8"))


def _on(workflow: dict) -> dict:
    return workflow.get(True, workflow.get("on", {}))


class CITriggerTests(unittest.TestCase):
    def test_tag_trigger_present(self):
        on = _on(_ci())
        push = on.get("push", {})
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
    """publish-containers must be a job-level reusable-workflow call."""

    def _job(self) -> dict:
        return _ci()["jobs"]["publish-containers"]

    def test_publish_containers_job_exists(self):
        self.assertIn("publish-containers", _ci()["jobs"])

    def test_publish_containers_uses_reusable_workflow_at_job_level(self):
        job = self._job()
        self.assertEqual(
            job.get("uses"),
            "./.github/workflows/docker-publish.yml",
            "publish-containers must invoke the reusable workflow at job level",
        )

    def test_publish_containers_has_no_runs_on(self):
        job = self._job()
        self.assertNotIn(
            "runs-on",
            job,
            "publish-containers (caller of a reusable workflow) must not declare runs-on",
        )

    def test_publish_containers_has_no_steps(self):
        job = self._job()
        self.assertNotIn(
            "steps",
            job,
            "publish-containers (caller of a reusable workflow) must not declare steps",
        )

    def test_publish_containers_with_is_a_job_level_dict(self):
        job = self._job()
        self.assertIn("with", job, "publish-containers must declare job-level `with:`")
        self.assertIsInstance(job["with"], dict)

    def test_publish_containers_passes_all_five_inputs(self):
        job = self._job()
        with_inputs = job["with"]
        for name in (
            "validated_sha",
            "validated_ref",
            "publish_kind",
            "version",
            "major_minor",
        ):
            with self.subTest(input=name):
                self.assertIn(
                    name,
                    with_inputs,
                    f"publish-containers must pass {name!r} to docker-publish.yml",
                )

    def test_publish_containers_inputs_reference_prepare_publish_outputs(self):
        job = self._job()
        with_inputs = job["with"]
        for name, value in with_inputs.items():
            with self.subTest(input=name):
                self.assertIn(
                    "needs.prepare-publish.outputs.",
                    value,
                    f"{name!r} must reference needs.prepare-publish.outputs.*, got {value!r}",
                )

    def test_publish_containers_no_github_sha_or_github_ref(self):
        job = self._job()
        # The caller's `with` block must not recompute github.sha/github.ref
        with_text = str(job.get("with", {}))
        self.assertNotIn("github.sha", with_text)
        self.assertNotIn("github.ref", with_text)

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
                self.assertIn(
                    required.split(":")[0],
                    perms,
                    f"publish-containers caller permissions must include {required!r}",
                )

    def test_aggregate_does_not_depend_on_publish_containers(self):
        aggregate = _ci()["jobs"]["aggregate"]
        self.assertNotIn(
            "publish-containers",
            aggregate.get("needs", []),
            "aggregate must not depend on publish-containers (no cycle)",
        )

    def test_only_slsa_provenance_depends_on_publish_containers(self):
        dependents = []
        for name, job in _ci()["jobs"].items():
            if name == "publish-containers":
                continue
            if "publish-containers" in job.get("needs", []):
                dependents.append(name)
        self.assertEqual(
            dependents,
            ["slsa-provenance"],
            "only the post-publish SLSA provenance job may depend on publish-containers",
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

    def _build_steps(self, name: str) -> list[dict]:
        return [
            step
            for step in self._job(name)["steps"]
            if isinstance(step, dict)
            and step.get("uses", "").startswith("docker/build-push-action")
        ]

    def test_backend_single_build_push_action(self):
        """Exactly one build-push-action invocation for the backend image."""
        self.assertEqual(
            len(self._build_steps("build-backend")),
            1,
            "build-backend must invoke docker/build-push-action exactly once",
        )

    def test_admin_single_build_push_action(self):
        """Exactly one build-push-action invocation for the admin image."""
        self.assertEqual(
            len(self._build_steps("build-admin")),
            1,
            "build-admin must invoke docker/build-push-action exactly once",
        )

    def test_backend_build_step_uses_full_sha_tag(self):
        # The build-push-action receives `tags` from the metadata step. The
        # contract is: metadata declares `sha-${{ inputs.validated_sha }}` as
        # one of its raw tags, so the final push always carries the full SHA.
        meta = next(
            s
            for s in self._job("build-backend")["steps"]
            if isinstance(s, dict) and s.get("uses", "").startswith("docker/metadata-action")
        )
        self.assertIn("sha-${{ inputs.validated_sha }}", meta["with"]["tags"])
        # build step's `tags:` must reference the metadata step output (not a literal)
        build_step = self._build_steps("build-backend")[0]
        self.assertIn("steps.meta-backend.outputs.tags", build_step["with"]["tags"])

    def test_admin_build_step_uses_full_sha_tag(self):
        meta = next(
            s
            for s in self._job("build-admin")["steps"]
            if isinstance(s, dict) and s.get("uses", "").startswith("docker/metadata-action")
        )
        self.assertIn("sha-${{ inputs.validated_sha }}", meta["with"]["tags"])
        build_step = self._build_steps("build-admin")[0]
        self.assertIn("steps.meta-admin.outputs.tags", build_step["with"]["tags"])

    def test_backend_context_preserved(self):
        step = self._build_steps("build-backend")[0]
        self.assertEqual(step["with"]["context"], "./backend")

    def test_admin_context_root_with_dockerfile(self):
        step = self._build_steps("build-admin")[0]
        self.assertEqual(step["with"]["context"], ".")
        self.assertEqual(step["with"]["file"], "admin/Dockerfile")

    def test_backend_build_step_has_cache_to(self):
        step = self._build_steps("build-backend")[0]
        self.assertEqual(step["with"]["cache-from"], "type=gha")
        self.assertEqual(step["with"]["cache-to"], "type=gha,mode=max")

    def test_admin_build_step_has_cache_to(self):
        step = self._build_steps("build-admin")[0]
        self.assertEqual(step["with"]["cache-from"], "type=gha")
        self.assertEqual(step["with"]["cache-to"], "type=gha,mode=max")

    def test_backend_build_step_has_labels(self):
        step = self._build_steps("build-backend")[0]
        self.assertIn("labels", step["with"])
        self.assertIn("meta-backend", step["with"]["labels"])

    def test_admin_build_step_has_labels(self):
        step = self._build_steps("build-admin")[0]
        self.assertIn("labels", step["with"])
        self.assertIn("meta-admin", step["with"]["labels"])

    def test_metadata_action_present_and_pinned(self):
        text = _docker_publish_text()
        self.assertIn("docker/metadata-action@dc802804100637a589fabce1cb79ff13a1411302", text)
        # No semver inference
        self.assertNotIn("type=semver", text)

    def test_backend_metadata_action_declares_all_four_raw_tags(self):
        step = next(
            s
            for s in self._job("build-backend")["steps"]
            if isinstance(s, dict) and s.get("uses", "").startswith("docker/metadata-action")
        )
        tags_block = step["with"]["tags"]
        self.assertIn("sha-${{ inputs.validated_sha }}", tags_block)
        self.assertIn("latest", tags_block)
        self.assertIn("inputs.version", tags_block)
        self.assertIn("inputs.major_minor", tags_block)
        # Must use raw type, never semver
        self.assertNotIn("semver", tags_block)
        self.assertRegex(tags_block, r"type=raw,value=sha-")
        self.assertRegex(tags_block, r"type=raw,value=latest")
        self.assertRegex(tags_block, r"type=raw,value=\$?\{\{ inputs\.version \}\}")
        self.assertRegex(tags_block, r"type=raw,value=\$?\{\{ inputs\.major_minor \}\}")

    def test_admin_metadata_action_declares_all_three_raw_tags(self):
        step = next(
            s
            for s in self._job("build-admin")["steps"]
            if isinstance(s, dict) and s.get("uses", "").startswith("docker/metadata-action")
        )
        tags_block = step["with"]["tags"]
        self.assertIn("sha-${{ inputs.validated_sha }}", tags_block)
        self.assertIn("latest", tags_block)
        self.assertIn("inputs.version", tags_block)
        # Admin does NOT receive a major_minor tag
        self.assertNotIn("inputs.major_minor", tags_block)

    def test_no_env_self_references_for_image_sha_tags(self):
        """Workflow-level env must not declare SHA-tag env values depending on
        another same-level env key. The base image refs and registry are fine;
        the SHA-tag fragments must be inline at consumption sites."""
        wf = _docker_publish()
        env = wf.get("env", {})
        for key in env:
            self.assertNotIn(
                "SHA_TAG",
                key,
                f"env key {key!r} looks like a SHA-tag fragment; inline at consumption site instead",
            )

    def test_no_inference_from_github_ref_in_steps(self):
        wf = _docker_publish()
        for job in wf["jobs"].values():
            for step in job.get("steps", []):
                step_text = str(step)
                self.assertNotIn("github.ref", step_text, f"step references github.ref: {step}")
                self.assertNotIn("github.sha", step_text, f"step references github.sha: {step}")

    def test_scan_uses_immutable_sha_tags(self):
        scan = _docker_publish()["jobs"]["scan"]
        for step in scan["steps"]:
            ref = step.get("with", {}).get("image-ref", "")
            if ref:
                self.assertIn(
                    "inputs.validated_sha", ref, f"scan must reference validated_sha, got {ref}"
                )
                self.assertNotIn(":latest", ref)

    def test_scan_does_not_use_continue_on_error(self):
        scan = _docker_publish()["jobs"]["scan"]
        for step in scan["steps"]:
            self.assertNotIn("continue-on-error", step)


class AdminDockerBuildValidationTests(unittest.TestCase):
    """The admin CI job must run a cached, non-publishing Buildx build."""

    def _admin_job(self) -> dict:
        return _ci()["jobs"]["admin"]

    def _build_step(self) -> dict:
        step = next(
            (
                step
                for step in self._admin_job()["steps"]
                if step.get("uses", "").startswith("docker/build-push-action")
            ),
            None,
        )
        self.assertIsNotNone(step, "admin job must invoke docker/build-push-action")
        return step

    def test_admin_buildx_setup_present(self):
        steps = self._admin_job()["steps"]
        self.assertTrue(
            any(step.get("uses", "").startswith("docker/setup-buildx-action") for step in steps)
        )

    def test_admin_build_push_action_present(self):
        self.assertEqual(
            self._build_step()["uses"],
            "docker/build-push-action@10e90e3645eae34f1e60eeb005ba3a3d33f178e8",
        )

    def test_admin_docker_build_step_uses_repo_root_context(self):
        self.assertEqual(self._build_step()["with"]["context"], ".")

    def test_admin_docker_build_step_uses_admin_dockerfile(self):
        self.assertEqual(self._build_step()["with"]["file"], "admin/Dockerfile")

    def test_admin_docker_build_step_has_no_push(self):
        self.assertFalse(self._build_step()["with"]["push"])

    def test_admin_docker_build_step_has_scoped_gha_cache(self):
        build = self._build_step()["with"]
        self.assertEqual(build["cache-from"], "type=gha,scope=admin-pr-validation")
        self.assertEqual(build["cache-to"], "type=gha,mode=max,scope=admin-pr-validation")

    def test_admin_docker_build_step_has_no_login(self):
        admin_text = str(self._admin_job())
        self.assertNotIn("docker/login-action", admin_text)
        self.assertNotIn("secrets.GITHUB_TOKEN", admin_text)

    def test_admin_docker_build_step_is_blocking(self):
        step = self._build_step()
        # No continue-on-error
        self.assertNotIn("continue-on-error", step)


class PnpmSetupCacheTests(unittest.TestCase):
    def test_setup_node_cache_is_bound_to_root_lockfile(self):
        setup_node = next(
            step
            for step in _pnpm_setup()["runs"]["steps"]
            if step.get("uses", "").startswith("actions/setup-node")
        )
        self.assertEqual(setup_node["with"]["cache"], "pnpm")
        self.assertEqual(setup_node["with"]["cache-dependency-path"], "pnpm-lock.yaml")


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


class P1AdminPytestT08ContractTests(unittest.TestCase):
    """T08: ``core/test_oauth_state.py`` MUST be referenced by the blocking
    ``P1 admin pytest`` step — not by an arbitrary, non-blocking duplicate.

    The assertion locates the step by a stable prefix on its ``name:``
    attribute (the only authoritative handle in the workflow) and checks the
    resolved ``run:`` block rather than a raw text grep, so a duplicate
    ``continue-on-error`` job or a stray mention elsewhere in the YAML cannot
    satisfy it.
    """

    STEP_NAME_PREFIX = "P1 admin pytest"
    TARGET_FILE = "core/test_oauth_state.py"

    @staticmethod
    def _find_step(workflow: dict, prefix: str) -> dict | None:
        for job in workflow.get("jobs", {}).values():
            for step in job.get("steps", []):
                if not isinstance(step, dict):
                    continue
                name = step.get("name")
                if isinstance(name, str) and name.startswith(prefix):
                    return step
        return None

    def test_p1_admin_pytest_step_exists(self):
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(
            step,
            f"workflow must declare a step named {self.STEP_NAME_PREFIX!r}*",
        )

    def test_p1_admin_pytest_step_runs_test_oauth_state(self):
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(step)
        run = step.get("run", "")
        self.assertIsInstance(run, str)
        self.assertIn(
            self.TARGET_FILE,
            run,
            (
                f"{self.STEP_NAME_PREFIX!r}* step must invoke pytest with "
                f"{self.TARGET_FILE!r}; run block was:\n{run}"
            ),
        )

    def test_p1_admin_pytest_step_is_blocking(self):
        """T08 must not be demoted to a non-blocking baseline.

        The step must NOT carry ``continue-on-error: true``. The next assertion
        rejects any duplicate reference to ``core/test_oauth_state.py`` that
        could silently swallow a failure.
        """
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(step)
        self.assertNotIn("continue-on-error", step)

    def test_p1_admin_pytest_step_is_not_duplicated_non_blocking(self):
        """No other step may silently swallow ``core/test_oauth_state.py``."""
        duplicate_count = 0
        for _job_name, job in _ci().get("jobs", {}).items():
            for step in job.get("steps", []):
                if not isinstance(step, dict):
                    continue
                name = step.get("name")
                if isinstance(name, str) and name.startswith(self.STEP_NAME_PREFIX):
                    continue
                run = step.get("run", "")
                if not isinstance(run, str):
                    continue
                if self.TARGET_FILE in run:
                    duplicate_count += 1
        self.assertEqual(
            duplicate_count,
            0,
            "core/test_oauth_state.py must not be referenced by any other step",
        )


class P1AdminPytestT09ContractTests(unittest.TestCase):
    """T09: ``activities/test_live_map_webhooks.py`` MUST be referenced by the
    blocking ``P1 admin pytest`` step — not by an arbitrary, non-blocking
    duplicate.

    The assertion locates the step by a stable prefix on its ``name:``
    attribute (the only authoritative handle in the workflow) and checks the
    resolved ``run:`` block rather than a raw text grep, so a duplicate
    ``continue-on-error`` job or a stray mention elsewhere in the YAML cannot
    satisfy it.
    """

    STEP_NAME_PREFIX = "P1 admin pytest"
    TARGET_FILE = "activities/test_live_map_webhooks.py"

    @staticmethod
    def _find_step(workflow: dict, prefix: str) -> dict | None:
        for job in workflow.get("jobs", {}).values():
            for step in job.get("steps", []):
                if not isinstance(step, dict):
                    continue
                name = step.get("name")
                if isinstance(name, str) and name.startswith(prefix):
                    return step
        return None

    def test_p1_admin_pytest_step_exists(self):
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(
            step,
            f"workflow must declare a step named {self.STEP_NAME_PREFIX!r}*",
        )

    def test_p1_admin_pytest_step_runs_test_live_map_webhooks(self):
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(step)
        run = step.get("run", "")
        self.assertIsInstance(run, str)
        self.assertIn(
            self.TARGET_FILE,
            run,
            (
                f"{self.STEP_NAME_PREFIX!r}* step must invoke pytest with "
                f"{self.TARGET_FILE!r}; run block was:\n{run}"
            ),
        )

    def test_p1_admin_pytest_step_is_blocking(self):
        """T09 must not be demoted to a non-blocking baseline.

        The step must NOT carry ``continue-on-error: true``. The next assertion
        rejects any duplicate reference to ``activities/test_live_map_webhooks.py``
        that could silently swallow a failure.
        """
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(step)
        self.assertNotIn("continue-on-error", step)

    def test_p1_admin_pytest_step_is_not_duplicated_non_blocking(self):
        """No other step may silently swallow ``activities/test_live_map_webhooks.py``."""
        duplicate_count = 0
        for _job_name, job in _ci().get("jobs", {}).items():
            for step in job.get("steps", []):
                if not isinstance(step, dict):
                    continue
                name = step.get("name")
                if isinstance(name, str) and name.startswith(self.STEP_NAME_PREFIX):
                    continue
                run = step.get("run", "")
                if not isinstance(run, str):
                    continue
                if self.TARGET_FILE in run:
                    duplicate_count += 1
        self.assertEqual(
            duplicate_count,
            0,
            "activities/test_live_map_webhooks.py must not be referenced by any other step",
        )


class P1AdminPytestT10ContractTests(unittest.TestCase):
    """T10: department / moderation / heatmap tenant-scope tests MUST be wired
    into the blocking ``P1 admin pytest`` step — and only into that step.

    Three test files must be referenced:

    * ``users/test_department_tenant_scope.py``
    * ``activities/test_moderation_tenant_scope.py``
    * ``activities/test_heatmap_tenant_scope.py``

    The step must remain blocking (no ``continue-on-error``) and there must be
    no duplicate reference that could silently swallow a failure.
    """

    STEP_NAME_PREFIX = "P1 admin pytest"
    TARGET_FILES = (
        "users/test_department_tenant_scope.py",
        "activities/test_moderation_tenant_scope.py",
        "activities/test_heatmap_tenant_scope.py",
    )

    @staticmethod
    def _find_step(workflow: dict, prefix: str) -> dict | None:
        for job in workflow.get("jobs", {}).values():
            for step in job.get("steps", []):
                if not isinstance(step, dict):
                    continue
                name = step.get("name")
                if isinstance(name, str) and name.startswith(prefix):
                    return step
        return None

    def test_p1_admin_pytest_step_exists(self):
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(
            step,
            f"workflow must declare a step named {self.STEP_NAME_PREFIX!r}*",
        )

    def test_p1_admin_pytest_step_runs_all_t10_test_files(self):
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(step)
        run = step.get("run", "")
        self.assertIsInstance(run, str)
        for target in self.TARGET_FILES:
            with self.subTest(target=target):
                self.assertIn(
                    target,
                    run,
                    (
                        f"{self.STEP_NAME_PREFIX!r}* step must invoke pytest with "
                        f"{target!r}; run block was:\n{run}"
                    ),
                )

    def test_p1_admin_pytest_step_is_blocking(self):
        """T10 must not be demoted to a non-blocking baseline."""
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(step)
        self.assertNotIn("continue-on-error", step)

    def test_no_other_step_references_t10_files(self):
        duplicate_count = 0
        for _job_name, job in _ci().get("jobs", {}).items():
            for step in job.get("steps", []):
                if not isinstance(step, dict):
                    continue
                name = step.get("name")
                if isinstance(name, str) and name.startswith(self.STEP_NAME_PREFIX):
                    continue
                run = step.get("run", "")
                if not isinstance(run, str):
                    continue
                for target in self.TARGET_FILES:
                    if target in run:
                        duplicate_count += 1
        self.assertEqual(
            duplicate_count,
            0,
            "T10 test files must not be referenced by any other CI step",
        )

    def test_backend_path_routing_triggers_backend_job(self):
        """The T10 test files live under ``backend/`` so the backend CI job
        must run when those paths change. The aggregate gate must continue to
        depend on the backend job.
        """
        # The path filter for "backend" is defined in the ``changes`` job and
        # drives the backend job's ``if:`` condition. Both must reference the
        # backend path key consistently.
        backend_job = _ci()["jobs"]["backend"]
        backend_if = backend_job.get("if", "")
        self.assertIn(
            "changes.outputs.backend",
            backend_if,
            "backend job must be guarded by the changes.backend path filter",
        )
        aggregate = _ci()["jobs"]["aggregate"]
        self.assertIn(
            "backend",
            aggregate.get("needs", []),
            "aggregate must depend on the backend job (T10 CI contract)",
        )


class T11RLSContractTests(unittest.TestCase):
    """T11: the canonical PostgreSQL RLS contract must be enforced by a
    blocking CI step in the existing backend job.

    The assertions verify the contract end-to-end rather than relying on
    a substring grep, so a future refactor cannot silently demote the gate.

    Requirements:

    * A blocking step (``continue-on-error`` absent) named ``T11 RLS ...``
      lives in the ``backend`` job and runs pytest on ``test_rls.py``.
    * The step's resolved ``run`` block contains a ``test_rls.py`` reference
      and a PostgreSQL ``DATABASE_URL`` — never ``sqlite``.
    * The step is NOT duplicated as a non-blocking baseline.
    * ``aggregate.needs`` continues to depend on the ``backend`` job.
    """

    STEP_NAME_PREFIX = "T11 RLS"
    TARGET_FILE = "test_rls.py"

    @staticmethod
    def _find_step(workflow: dict, prefix: str) -> dict | None:
        for job in workflow.get("jobs", {}).values():
            for step in job.get("steps", []):
                if not isinstance(step, dict):
                    continue
                name = step.get("name")
                if isinstance(name, str) and name.startswith(prefix):
                    return step
        return None

    def test_t11_step_exists(self):
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(
            step,
            f"workflow must declare a step named {self.STEP_NAME_PREFIX!r}*",
        )

    def test_t11_step_runs_test_rls(self):
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(step)
        run = step.get("run", "")
        self.assertIsInstance(run, str)
        self.assertIn(
            self.TARGET_FILE,
            run,
            (
                f"{self.STEP_NAME_PREFIX!r}* step must invoke pytest with "
                f"{self.TARGET_FILE!r}; run block was:\n{run}"
            ),
        )

    def test_t11_step_uses_postgresql_backend(self):
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(step)
        env = step.get("env", {})
        db_url = env.get("DATABASE_URL", "")
        self.assertTrue(
            db_url.startswith("postgres://") or db_url.startswith("postgresql://"),
            f"T11 step DATABASE_URL must be PostgreSQL, got {db_url!r}",
        )
        self.assertNotIn("sqlite", db_url.lower())

    def test_t11_step_does_not_use_sqlite_in_any_field(self):
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(step)
        text = str(step)
        self.assertNotIn(
            "sqlite",
            text.lower(),
            "T11 step must not reference SQLite anywhere",
        )

    def test_t11_step_does_not_invoke_run_pytest_py(self):
        """T11 RLS test must NOT go through ``backend/run_pytest.py`` because
        that runner monkey-patches ``dj_database_url.parse`` and forces a
        SQLite engine even when ``DATABASE_URL`` points at PostgreSQL, which
        would silently make the test pass against a fake backend.

        The step must invoke ``python -m pytest`` (or an equivalent runner
        that preserves the real PostGIS backend) so that any real RLS
        regression surfaces as a FAIL.
        """
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(step)
        run = step.get("run", "")
        self.assertIsInstance(run, str)
        self.assertNotIn(
            "run_pytest.py",
            run,
            (
                "T11 step must not invoke backend/run_pytest.py — that runner "
                "forces a SQLite engine via dj_database_url monkeypatch and "
                "would mask real RLS failures.\n"
                f"run block was:\n{run}"
            ),
        )
        self.assertIn(
            "pytest",
            run,
            (
                "T11 step must invoke a real pytest runner (python -m pytest) "
                "so the configured PostGIS backend is preserved.\n"
                f"run block was:\n{run}"
            ),
        )

    def test_t11_step_is_blocking(self):
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(step)
        self.assertNotIn(
            "continue-on-error",
            step,
            "T11 RLS step must be blocking — no continue-on-error",
        )

    def test_t11_step_is_not_duplicated_non_blocking(self):
        duplicate_count = 0
        for _job_name, job in _ci().get("jobs", {}).items():
            for step in job.get("steps", []):
                if not isinstance(step, dict):
                    continue
                name = step.get("name")
                if isinstance(name, str) and name.startswith(self.STEP_NAME_PREFIX):
                    continue
                run = step.get("run", "")
                if not isinstance(run, str):
                    continue
                if self.TARGET_FILE in run:
                    duplicate_count += 1
        self.assertEqual(
            duplicate_count,
            0,
            f"{self.TARGET_FILE} must not be referenced by any other CI step",
        )

    def test_t11_step_lives_in_backend_job(self):
        for job_name, job in _ci().get("jobs", {}).items():
            for step in job.get("steps", []):
                if not isinstance(step, dict):
                    continue
                name = step.get("name")
                if isinstance(name, str) and name.startswith(self.STEP_NAME_PREFIX):
                    self.assertEqual(
                        job_name,
                        "backend",
                        f"T11 step must live in backend job, found in {job_name!r}",
                    )
                    return
        self.fail("T11 step not found")

    def test_aggregate_still_depends_on_backend(self):
        """Adding the T11 step must not remove the backend job from the
        aggregate gate's ``needs``."""
        aggregate = _ci()["jobs"]["aggregate"]
        self.assertIn(
            "backend",
            aggregate.get("needs", []),
            "aggregate must continue to depend on the backend job (T11 contract)",
        )

    def test_t11_step_does_not_reinstall_pytest_in_job(self):
        """pytest / pytest-django must be installed earlier in the backend
        job (see ``Simulator light tests`` step); the T11 step must rely
        on those existing wheels instead of triggering another
        ``pip install pytest pytest-django`` whose version pinning is not
        controlled by the repo's dependency manifest.
        """
        step = self._find_step(_ci(), self.STEP_NAME_PREFIX)
        self.assertIsNotNone(step)
        run = step.get("run", "")
        self.assertIsInstance(run, str)
        self.assertNotIn(
            "pip install",
            run,
            (
                "T11 step must not run ``pip install`` - pytest / "
                "pytest-django are deterministic dependencies of the repo "
                "and must be installed once, earlier in the backend job.\n"
                f"run block was:\n{run}"
            ),
        )

    def test_backend_job_does_not_reference_legacy_sport_test_credentials(self):
        """The isolated PostgreSQL service for the backend job was renamed
        from the legacy ``sport_*`` triple to a coherent ``fourvelo_ci``
        triple. This assertion guards against accidental reintroduction
        of the legacy names in any backend step - those names belong to
        the deprecated ``sport`` branding and must not appear in the
        canonical 4VELO CI configuration.
        """
        backend = _ci()["jobs"]["backend"]
        text = yaml.safe_dump(backend, sort_keys=False)
        for forbidden in ("sport_user", "sport_pass", "sport_test"):
            self.assertNotIn(
                forbidden,
                text,
                (
                    f"backend job must not reference legacy {forbidden!r}; "
                    f"use the fourvelo_ci triple instead"
                ),
            )
        # Positive: the new triple must be present in the service config.
        self.assertIn(
            "fourvelo_ci",
            yaml.safe_dump(_ci()["jobs"]["backend"]["services"], sort_keys=False),
            "backend postgres service must declare the fourvelo_ci triple",
        )


if __name__ == "__main__":
    unittest.main()
