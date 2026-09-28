import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import call, patch

import t76_chaos


class T76ChaosTests(unittest.TestCase):
    def test_parse_adb_devices_keeps_only_authorized_online_devices(self):
        output = """List of devices attached
ABC123\tdevice product:x model:Phone
OFFLINE1\toffline
DENIED1\tunauthorized

"""
        self.assertEqual(t76_chaos.parse_adb_devices(output), ["ABC123"])

    def test_select_device_requires_unambiguous_authorized_device(self):
        self.assertEqual(t76_chaos.select_device(["ABC123"], None), "ABC123")
        self.assertEqual(t76_chaos.select_device(["A", "B"], "B"), "B")
        with self.assertRaises(t76_chaos.T76Error):
            t76_chaos.select_device([], None)
        with self.assertRaises(t76_chaos.T76Error):
            t76_chaos.select_device(["A", "B"], None)
        with self.assertRaises(t76_chaos.T76Error):
            t76_chaos.select_device(["A"], "B")

    def test_serial_fingerprint_does_not_expose_serial(self):
        fingerprint = t76_chaos.serial_fingerprint("ABC123")
        self.assertEqual(len(fingerprint), 64)
        self.assertNotIn("ABC123", fingerprint)

    def test_restart_service_reuses_canonical_home_lab_compose_command(self):
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / ".env.home"
            env.write_text("initialized", encoding="utf-8")
            with (
                patch.object(t76_chaos, "HOME_ENV", env),
                patch.object(
                    t76_chaos.home_lab,
                    "compose_command",
                    side_effect=[["compose-restart"], ["compose-up"]],
                ) as compose_mock,
                patch.object(t76_chaos, "run_visible") as run_mock,
                patch.object(t76_chaos, "check_home_lab") as check_mock,
            ):
                t76_chaos.restart_service("backend")

        self.assertEqual(
            compose_mock.call_args_list,
            [call("restart", "backend"), call("up", "-d", "--wait")],
        )
        self.assertEqual(
            [item.args[0] for item in run_mock.call_args_list],
            [["compose-restart"], ["compose-up"]],
        )
        check_mock.assert_called_once_with()

    @staticmethod
    def _artifact_dir(
        folder: str,
        *,
        repo_sha: str = "a" * 40,
        apk_bytes: bytes = b"runtime-apk",
        manifest_overrides: dict | None = None,
    ) -> Path:
        root = Path(folder)
        apk_hash = hashlib.sha256(apk_bytes).hexdigest()
        manifest = {
            "sourceHeadSha": repo_sha,
            "builtGitSha": repo_sha,
            "workflowRunId": "123456",
            "apkSha256": apk_hash,
            "packageId": t76_chaos.PACKAGE,
            "buildProfile": "pilot-local",
            "updatesEnabled": False,
            "visionFixtures": "true",
            "runtimeAcceptance": "true",
            "nodeEnv": "production",
        }
        if manifest_overrides:
            manifest.update(manifest_overrides)
        (root / "manifest.json").write_text(
            json.dumps(manifest),
            encoding="utf-8",
        )
        (root / "app-release.apk").write_bytes(apk_bytes)
        return root

    def test_runtime_artifact_validates_exact_sha_and_local_apk_hash(self):
        with tempfile.TemporaryDirectory() as folder:
            root = self._artifact_dir(folder)
            provenance = t76_chaos.validate_runtime_artifact(root, "a" * 40)

        self.assertEqual(provenance["mode"], "ci-runtime-artifact")
        self.assertEqual(provenance["source_head_sha"], "a" * 40)
        self.assertEqual(provenance["built_git_sha"], "a" * 40)
        self.assertEqual(
            provenance["apk_sha256"],
            hashlib.sha256(b"runtime-apk").hexdigest(),
        )
        self.assertEqual(provenance["workflow_run_id"], "123456")

    def test_runtime_artifact_rejects_source_or_apk_hash_drift(self):
        with tempfile.TemporaryDirectory() as folder:
            root = self._artifact_dir(folder, manifest_overrides={"sourceHeadSha": "b" * 40})
            with self.assertRaises(t76_chaos.T76Error):
                t76_chaos.validate_runtime_artifact(root, "a" * 40)

        with tempfile.TemporaryDirectory() as folder:
            root = self._artifact_dir(folder, manifest_overrides={"apkSha256": "0" * 64})
            with self.assertRaises(t76_chaos.T76Error):
                t76_chaos.validate_runtime_artifact(root, "a" * 40)

    def test_installed_apk_hash_reads_exact_package_bytes(self):
        payload = b"installed-base-apk"
        with (
            patch.object(
                t76_chaos,
                "adb",
                return_value="package:/data/app/example/base.apk\n",
            ),
            patch.object(
                t76_chaos.subprocess,
                "run",
                return_value=SimpleNamespace(
                    returncode=0,
                    stdout=payload,
                    stderr=b"",
                ),
            ) as run_mock,
        ):
            digest = t76_chaos.installed_apk_sha256("SERIAL")

        self.assertEqual(digest, hashlib.sha256(payload).hexdigest())
        self.assertEqual(
            run_mock.call_args.args[0],
            [
                "adb",
                "-s",
                "SERIAL",
                "exec-out",
                "cat",
                "/data/app/example/base.apk",
            ],
        )

    def test_installed_runtime_artifact_must_match_ci_apk_hash(self):
        expected = hashlib.sha256(b"runtime-apk").hexdigest()
        provenance = {"mode": "ci-runtime-artifact", "apk_sha256": expected}

        with patch.object(t76_chaos, "installed_apk_sha256", return_value=expected):
            verified = t76_chaos.verify_installed_runtime_artifact(
                "SERIAL", provenance
            )
        self.assertEqual(
            verified["mode"],
            "ci-runtime-artifact-installed-apk-sha256",
        )
        self.assertEqual(verified["installed_apk_sha256"], expected)

        with (
            patch.object(t76_chaos, "installed_apk_sha256", return_value="f" * 64),
            self.assertRaises(t76_chaos.T76Error),
        ):
            t76_chaos.verify_installed_runtime_artifact("SERIAL", provenance)

    @staticmethod
    def _evidence(*, exact_artifact: bool = True):
        artifact_hash = "a" * 64
        provenance = (
            {
                "mode": "ci-runtime-artifact-installed-apk-sha256",
                "apk_sha256": artifact_hash,
                "installed_apk_sha256": artifact_hash,
            }
            if exact_artifact
            else {
                "mode": "operator-sha-attestation",
                "source_head_sha": "a" * 40,
            }
        )
        return {
            "schema_version": 2,
            "tranche": "T76",
            "overall_status": "INCOMPLETE",
            "completed_at_utc": None,
            "artifact_provenance": provenance,
            "scenarios": {
                scenario_id: {
                    "title": title,
                    "status": "NOT_RUN",
                    "observed_at_utc": None,
                    "device_observed": False,
                    "server_observed": False,
                    "note": None,
                }
                for scenario_id, title in t76_chaos.SCENARIOS.items()
            },
        }

    def test_pass_cannot_be_recorded_from_command_execution_alone(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "evidence.json"
            t76_chaos.write_evidence(path, self._evidence())

            with self.assertRaises(t76_chaos.T76Error):
                t76_chaos.record_result(
                    path,
                    "T76-01",
                    "PASS",
                    "screen-off test looked correct",
                    device_observed=True,
                    server_observed=False,
                )

            stored = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(stored["scenarios"]["T76-01"]["status"], "NOT_RUN")

    def test_explicit_device_and_server_observation_can_record_pass(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "evidence.json"
            t76_chaos.write_evidence(path, self._evidence())

            t76_chaos.record_result(
                path,
                "T76-01",
                "PASS",
                "device kept recovery state and server showed one canonical activity",
                device_observed=True,
                server_observed=True,
            )

            stored = json.loads(path.read_text(encoding="utf-8"))
            item = stored["scenarios"]["T76-01"]
            self.assertEqual(item["status"], "PASS")
            self.assertTrue(item["device_observed"])
            self.assertTrue(item["server_observed"])
            self.assertTrue(item["observed_at_utc"])

    def test_missing_scenario_is_rejected_as_malformed_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "evidence.json"
            evidence = self._evidence()
            evidence["scenarios"].pop("T76-08")
            t76_chaos.write_evidence(path, evidence)

            with self.assertRaises(t76_chaos.T76Error):
                t76_chaos.load_evidence(path)

    def test_finalize_requires_exact_installed_ci_artifact_provenance(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "evidence.json"
            evidence = self._evidence(exact_artifact=False)
            for item in evidence["scenarios"].values():
                item.update(
                    {
                        "status": "PASS",
                        "device_observed": True,
                        "server_observed": True,
                        "note": "verified",
                        "observed_at_utc": t76_chaos.utc_now(),
                    }
                )
            t76_chaos.write_evidence(path, evidence)

            with self.assertRaises(t76_chaos.T76Error):
                t76_chaos.finalize_evidence(path)

    def test_finalize_fails_closed_until_every_scenario_passes(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "evidence.json"
            t76_chaos.write_evidence(path, self._evidence())

            with self.assertRaises(t76_chaos.T76Error):
                t76_chaos.finalize_evidence(path)

            stored = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(stored["overall_status"], "INCOMPLETE")
            self.assertIsNone(stored["completed_at_utc"])

    def test_finalize_passes_only_after_complete_matrix(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "evidence.json"
            evidence = self._evidence()
            for item in evidence["scenarios"].values():
                item.update(
                    {
                        "status": "PASS",
                        "device_observed": True,
                        "server_observed": True,
                        "note": "verified",
                        "observed_at_utc": t76_chaos.utc_now(),
                    }
                )
            t76_chaos.write_evidence(path, evidence)

            completed = t76_chaos.finalize_evidence(path)

            self.assertEqual(completed["overall_status"], "PASS")
            self.assertTrue(completed["completed_at_utc"])

    def test_any_failed_scenario_makes_final_evidence_fail(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "evidence.json"
            evidence = self._evidence()
            for item in evidence["scenarios"].values():
                item["status"] = "PASS"
            evidence["scenarios"]["T76-05"]["status"] = "FAIL"
            t76_chaos.write_evidence(path, evidence)

            with self.assertRaises(t76_chaos.T76Error):
                t76_chaos.finalize_evidence(path)

            stored = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(stored["overall_status"], "FAIL")


if __name__ == "__main__":
    unittest.main()
