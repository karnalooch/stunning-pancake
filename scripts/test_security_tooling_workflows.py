"""Contract tests for the 4VELO security-tooling suite."""

from __future__ import annotations

import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CI = ROOT / ".github" / "workflows" / "ci.yml"
DOCKER = ROOT / ".github" / "workflows" / "docker-publish.yml"
K8S = ROOT / ".github" / "workflows" / "k8s-release-gate.yml"
SCORECARD = ROOT / ".github" / "workflows" / "scorecard.yml"
MOBSF = ROOT / ".github" / "workflows" / "mobsf.yml"


def load(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class CodeQLContractTests(unittest.TestCase):
    def test_codeql_scans_python_and_javascript_typescript(self):
        job = load(CI)["jobs"]["codeql"]
        self.assertEqual(
            set(job["strategy"]["matrix"]["language"]),
            {"python", "javascript-typescript"},
        )
        self.assertEqual(job["permissions"]["security-events"], "write")
        init = next(
            s for s in job["steps"] if str(s.get("uses", "")).startswith("github/codeql-action/init")
        )
        self.assertEqual(init["with"]["build-mode"], "none")
        self.assertEqual(init["with"]["queries"], "security-extended")

    def test_codeql_failure_reaches_aggregate(self):
        needs = load(CI)["jobs"]["aggregate"]["needs"]
        self.assertIn("codeql", needs)


class DependencyReviewContractTests(unittest.TestCase):
    def test_dependency_review_is_pr_only_and_blocks_high(self):
        job = load(CI)["jobs"]["dependency-review"]
        self.assertIn("pull_request", job["if"])
        action = next(
            s for s in job["steps"]
            if str(s.get("uses", "")).startswith("actions/dependency-review-action")
        )
        self.assertEqual(
            action["uses"],
            "actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294",
        )
        self.assertEqual(action["with"]["fail-on-severity"], "high")

    def test_dependency_review_failure_reaches_aggregate(self):
        self.assertIn("dependency-review", load(CI)["jobs"]["aggregate"]["needs"])


class ScorecardContractTests(unittest.TestCase):
    def test_scorecard_is_periodic_and_manual_not_pr_blocking(self):
        wf = load(SCORECARD)
        trigger = wf.get(True, wf.get("on", {}))
        self.assertIn("schedule", trigger)
        self.assertIn("workflow_dispatch", trigger)
        self.assertNotIn("pull_request", trigger)

    def test_scorecard_action_is_pinned_and_publishes_sarif(self):
        wf = load(SCORECARD)
        job = wf["jobs"]["scorecard"]
        self.assertEqual(job["permissions"]["id-token"], "write")
        self.assertEqual(job["permissions"]["security-events"], "write")
        run = next(
            s for s in job["steps"] if str(s.get("uses", "")).startswith("ossf/scorecard-action")
        )
        self.assertEqual(
            run["uses"],
            "ossf/scorecard-action@2d1146689b8cda280b9bc96326124645441f03bc",
        )
        self.assertTrue(run["with"]["publish_results"])
        self.assertEqual(run["with"]["results_format"], "sarif")
        self.assertIn("github/codeql-action/upload-sarif@v4", text(SCORECARD))


class SLSAContractTests(unittest.TestCase):
    def test_published_image_digests_are_exported_as_subjects(self):
        wf = load(DOCKER)
        outputs = wf.get(True, wf.get("on", {}))["workflow_call"]["outputs"]
        self.assertIn("slsa_subjects", outputs)
        prep = wf["jobs"]["prepare-provenance-subjects"]
        self.assertEqual(set(prep["needs"]), {"build-backend", "build-admin"})
        raw = text(DOCKER)
        self.assertIn("steps.build-backend.outputs.digest", raw)
        self.assertIn("steps.build-admin.outputs.digest", raw)
        self.assertIn("sha256:[0-9a-f]{64}", raw)

    def test_slsa_generic_generator_runs_only_after_publish(self):
        job = load(CI)["jobs"]["slsa-provenance"]
        self.assertEqual(job["needs"], ["publish-containers"])
        self.assertEqual(job["permissions"]["id-token"], "write")
        self.assertEqual(
            job["uses"],
            "slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v2.1.0",
        )
        self.assertIn("publish-containers.outputs.slsa_subjects", job["with"]["base64-subjects"])


class KubesecContractTests(unittest.TestCase):
    def test_kubesec_is_version_pinned_and_advisory(self):
        wf = load(K8S)
        job = wf["jobs"]["k8s_manifest_validation"]
        step = next(s for s in job["steps"] if s.get("name") == "Kubesec workload posture audit (advisory)")
        self.assertTrue(step["continue-on-error"])
        raw = text(K8S)
        self.assertIn("v2.14.2/kubesec_linux_amd64.tar.gz", raw)
        self.assertIn(
            "bc252e35f01bc4f133a49404315da3ccfed0209cc9baba33883eaeca0656f35c",
            raw,
        )
        self.assertNotIn("kubesec_checksums.txt", raw)
        self.assertIn("sha256sum -c -", raw)


class WorkflowDependencyPinningTests(unittest.TestCase):
    def test_security_contract_installs_pyyaml_with_hash_verification(self):
        raw = text(CI)
        self.assertIn("python -m pip install --require-hashes", raw)
        self.assertIn(
            "PyYAML==6.0.3 --hash=sha256:dbad07666e1656f0f4349c7d35b45406ffd57a289b6e0b49c3c9c2ca40fe5e3c",
            raw,
        )


class MobSFContractTests(unittest.TestCase):
    def test_mobsf_source_action_is_release_pinned(self):
        wf = load(MOBSF)
        job = wf["jobs"]["mobsf-source"]
        step = next(
            s for s in job["steps"] if str(s.get("uses", "")).startswith("MobSF/mobsfscan")
        )
        self.assertEqual(
            step["uses"],
            "MobSF/mobsfscan@a43635d92434e78b079ed7d860f022cf6c886b43",
        )
        self.assertIn("--sarif", step["with"]["args"])

    def test_apk_scan_is_manual_verified_and_version_pinned(self):
        wf = load(MOBSF)
        job = wf["jobs"]["mobsf-apk"]
        self.assertIn("workflow_dispatch", job["if"])
        self.assertEqual(
            job["env"]["MOBSF_IMAGE"],
            "opensecurity/mobile-security-framework-mobsf:v4.5.2",
        )
        raw = text(MOBSF)
        self.assertIn("https://expo\\.dev/artifacts/eas/", raw)
        self.assertIn("sha256sum -c -", raw)
        self.assertIn("/api/v1/upload", raw)
        self.assertIn("/api/v1/scan", raw)
        self.assertIn("/api/v1/report_json", raw)
        self.assertIn("/api/v1/download_pdf", raw)


if __name__ == "__main__":
    unittest.main()
