import json
import tempfile
import unittest
from pathlib import Path

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

    @staticmethod
    def _evidence():
        return {
            "schema_version": 1,
            "tranche": "T76",
            "overall_status": "INCOMPLETE",
            "completed_at_utc": None,
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
