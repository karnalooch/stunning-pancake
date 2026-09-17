#!/usr/bin/env python3
"""T76 physical Android/home-lab chaos evidence harness.

This tool prepares and records the external evidence required by T76. It never
marks a scenario PASS merely because an adb/Docker command succeeded: PASS
requires explicit device and server observations from the operator.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "backups" / "home-lab" / "evidence"
HOME_ENV = ROOT / ".env.home"
PACKAGE = "com.sport.athlete"
ADB_REVERSE_PORTS = (8000, 8001, 8081)
FAULT_SERVICES = ("backend", "telemetry", "redis", "db")

SCENARIOS = {
    "T76-01": "Locked/screen-off ride keeps durable GPS and resumes cleanly",
    "T76-02": "Offline ride reconnect drains durable GPS without silent loss",
    "T76-03": "Force-stop/relaunch while offline preserves recovery state",
    "T76-04": "Backend restart/ambiguous session-finalize response creates one business effect",
    "T76-05": "Telemetry restart/ambiguous batch ACK replays to one durable receipt/effect",
    "T76-06": "Redis restart does not invalidate pilot direct-DB durable ACK contract",
    "T76-07": "Database restart during pending upload recovers without silent loss/duplication",
    "T76-08": "Combined app kill + service recovery completes one canonical activity",
}


class T76Error(RuntimeError):
    """Raised when the evidence harness cannot prove a required precondition."""


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def run_capture(command: list[str], *, check: bool = True) -> str:
    result = subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        text=True,
        capture_output=True,
    )
    if check and result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise T76Error(f"Command failed ({result.returncode}): {' '.join(command)}\n{detail}")
    return result.stdout


def run_visible(command: list[str]) -> None:
    result = subprocess.run(command, cwd=ROOT, check=False)
    if result.returncode != 0:
        raise T76Error(f"Command failed ({result.returncode}): {' '.join(command)}")


def parse_adb_devices(output: str) -> list[str]:
    devices: list[str] = []
    for raw in output.splitlines():
        line = raw.strip()
        if not line or line.startswith("List of devices attached"):
            continue
        fields = line.split()
        if len(fields) >= 2 and fields[1] == "device":
            devices.append(fields[0])
    return devices


def select_device(devices: list[str], requested: str | None) -> str:
    if requested:
        if requested not in devices:
            raise T76Error(f"Requested adb device is not authorized/online: {requested}")
        return requested
    if len(devices) != 1:
        raise T76Error(
            "Exactly one authorized adb device is required when --serial is omitted; "
            f"found {len(devices)}"
        )
    return devices[0]


def adb(serial: str, *args: str, capture: bool = True) -> str:
    command = ["adb", "-s", serial, *args]
    if capture:
        return run_capture(command)
    run_visible(command)
    return ""


def adb_prop(serial: str, name: str) -> str:
    return adb(serial, "shell", "getprop", name).strip()


def app_version(serial: str) -> str:
    output = adb(serial, "shell", "dumpsys", "package", PACKAGE)
    for raw in output.splitlines():
        line = raw.strip()
        if line.startswith("versionName="):
            return line.split("=", 1)[1].strip()
    return "unknown"


def exact_git_sha() -> str:
    return run_capture(["git", "rev-parse", "HEAD"]).strip()


def serial_fingerprint(serial: str) -> str:
    return hashlib.sha256(serial.encode("utf-8")).hexdigest()


def setup_adb_reverse(serial: str) -> None:
    for port in ADB_REVERSE_PORTS:
        adb(serial, "reverse", f"tcp:{port}", f"tcp:{port}")
    listing = adb(serial, "reverse", "--list")
    for port in ADB_REVERSE_PORTS:
        marker = f"tcp:{port} tcp:{port}"
        if marker not in listing:
            raise T76Error(f"Missing adb reverse mapping: {marker}")


def verify_package(serial: str) -> None:
    output = adb(serial, "shell", "pm", "path", PACKAGE).strip()
    if not output.startswith("package:"):
        raise T76Error(f"{PACKAGE} is not installed on the selected device")


def check_home_lab() -> None:
    if not HOME_ENV.is_file():
        raise T76Error("Missing .env.home; initialize the home lab first")
    run_visible([sys.executable, str(ROOT / "scripts" / "home_lab.py"), "check"])


def evidence_path() -> Path:
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    return EVIDENCE_DIR / f"t76-chaos-{stamp}.json"


def new_evidence(serial: str) -> dict:
    return {
        "schema_version": 1,
        "tranche": "T76",
        "contract": "physical-android-home-lab-chaos",
        "overall_status": "INCOMPLETE",
        "created_at_utc": utc_now(),
        "completed_at_utc": None,
        "exact_git_sha": exact_git_sha(),
        "device": {
            "serial_sha256": serial_fingerprint(serial),
            "model": adb_prop(serial, "ro.product.model"),
            "android_release": adb_prop(serial, "ro.build.version.release"),
            "sdk": adb_prop(serial, "ro.build.version.sdk"),
            "app_package": PACKAGE,
            "app_version": app_version(serial),
        },
        "pilot_topology": {
            "adb_reverse_ports": list(ADB_REVERSE_PORTS),
            "home_lab_loopback_only": True,
            "telemetry_ack_mode": "direct-db",
        },
        "operator_attestation_required": True,
        "scenarios": {
            scenario_id: {
                "title": title,
                "status": "NOT_RUN",
                "observed_at_utc": None,
                "device_observed": False,
                "server_observed": False,
                "note": None,
            }
            for scenario_id, title in SCENARIOS.items()
        },
    }


def write_evidence(path: Path, evidence: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def load_evidence(path: Path) -> dict:
    try:
        evidence = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise T76Error(f"Cannot read T76 evidence: {path}") from exc
    if evidence.get("tranche") != "T76" or not isinstance(evidence.get("scenarios"), dict):
        raise T76Error("Not a T76 evidence file")
    return evidence


def record_result(
    path: Path,
    scenario_id: str,
    result: str,
    note: str,
    *,
    device_observed: bool,
    server_observed: bool,
) -> dict:
    if scenario_id not in SCENARIOS:
        raise T76Error(f"Unknown scenario: {scenario_id}")
    if result not in {"PASS", "FAIL", "BLOCKED"}:
        raise T76Error("Result must be PASS, FAIL or BLOCKED")
    if not note.strip():
        raise T76Error("A short observation note is required")
    if result == "PASS" and not (device_observed and server_observed):
        raise T76Error(
            "PASS requires both --device-observed and --server-observed; "
            "command execution alone is not physical evidence"
        )

    evidence = load_evidence(path)
    item = evidence["scenarios"][scenario_id]
    item.update(
        {
            "status": result,
            "observed_at_utc": utc_now(),
            "device_observed": bool(device_observed),
            "server_observed": bool(server_observed),
            "note": note.strip(),
        }
    )
    evidence["overall_status"] = "INCOMPLETE"
    evidence["completed_at_utc"] = None
    write_evidence(path, evidence)
    return evidence


def finalize_evidence(path: Path) -> dict:
    evidence = load_evidence(path)
    statuses = [item.get("status") for item in evidence["scenarios"].values()]
    if any(status == "FAIL" for status in statuses):
        evidence["overall_status"] = "FAIL"
        evidence["completed_at_utc"] = utc_now()
        write_evidence(path, evidence)
        raise T76Error("T76 evidence contains a failed scenario")
    if not statuses or any(status != "PASS" for status in statuses):
        evidence["overall_status"] = "INCOMPLETE"
        evidence["completed_at_utc"] = None
        write_evidence(path, evidence)
        missing = [
            scenario_id
            for scenario_id, item in evidence["scenarios"].items()
            if item.get("status") != "PASS"
        ]
        raise T76Error(f"T76 evidence is incomplete: {', '.join(missing)}")

    evidence["overall_status"] = "PASS"
    evidence["completed_at_utc"] = utc_now()
    write_evidence(path, evidence)
    return evidence


def preflight(serial: str | None, output: Path | None) -> Path:
    devices = parse_adb_devices(run_capture(["adb", "devices"]))
    selected = select_device(devices, serial)
    verify_package(selected)
    setup_adb_reverse(selected)
    check_home_lab()

    target = (output or evidence_path()).expanduser().resolve()
    if target.exists():
        raise T76Error(f"Refusing to overwrite existing evidence: {target}")
    write_evidence(target, new_evidence(selected))
    print(f"T76 preflight PASS; evidence initialized: {target}")
    return target


def restart_service(service: str) -> None:
    if service not in FAULT_SERVICES:
        raise T76Error(f"Unsupported fault service: {service}")
    if not HOME_ENV.is_file():
        raise T76Error("Missing .env.home; initialize the home lab first")
    command = [
        "docker",
        "compose",
        "-p",
        "4velo-home",
        "--env-file",
        str(HOME_ENV),
        "-f",
        str(ROOT / "docker-compose.yml"),
        "-f",
        str(ROOT / "docker-compose.home.yml"),
        "restart",
        service,
    ]
    run_visible(command)
    run_visible(
        [
            "docker",
            "compose",
            "-p",
            "4velo-home",
            "--env-file",
            str(HOME_ENV),
            "-f",
            str(ROOT / "docker-compose.yml"),
            "-f",
            str(ROOT / "docker-compose.home.yml"),
            "up",
            "-d",
            "--wait",
        ]
    )
    check_home_lab()
    print(f"Injected and recovered service restart: {service}")


def force_stop(serial: str | None) -> None:
    devices = parse_adb_devices(run_capture(["adb", "devices"]))
    selected = select_device(devices, serial)
    adb(selected, "shell", "am", "force-stop", PACKAGE, capture=False)
    print(f"Force-stopped {PACKAGE}; relaunch manually when the scenario requires it")


def screen_off(serial: str | None) -> None:
    devices = parse_adb_devices(run_capture(["adb", "devices"]))
    selected = select_device(devices, serial)
    adb(selected, "shell", "input", "keyevent", "26", capture=False)
    print("Sent Android power keyevent; verify the device is actually locked/screen-off")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)

    pre = sub.add_parser("preflight")
    pre.add_argument("--serial")
    pre.add_argument("--evidence", type=Path)

    fault = sub.add_parser("restart-service")
    fault.add_argument("--service", choices=FAULT_SERVICES, required=True)

    stop = sub.add_parser("force-stop")
    stop.add_argument("--serial")

    off = sub.add_parser("screen-off")
    off.add_argument("--serial")

    record = sub.add_parser("record")
    record.add_argument("evidence", type=Path)
    record.add_argument("--scenario", choices=tuple(SCENARIOS), required=True)
    record.add_argument("--result", choices=("PASS", "FAIL", "BLOCKED"), required=True)
    record.add_argument("--note", required=True)
    record.add_argument("--device-observed", action="store_true")
    record.add_argument("--server-observed", action="store_true")

    final = sub.add_parser("finalize")
    final.add_argument("evidence", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        if args.action == "preflight":
            preflight(args.serial, args.evidence)
        elif args.action == "restart-service":
            restart_service(args.service)
        elif args.action == "force-stop":
            force_stop(args.serial)
        elif args.action == "screen-off":
            screen_off(args.serial)
        elif args.action == "record":
            record_result(
                args.evidence,
                args.scenario,
                args.result,
                args.note,
                device_observed=args.device_observed,
                server_observed=args.server_observed,
            )
            print(f"Recorded {args.scenario}={args.result}")
        elif args.action == "finalize":
            finalize_evidence(args.evidence)
            print("T76 evidence PASS: every required physical scenario is explicitly observed")
    except T76Error as exc:
        raise SystemExit(str(exc)) from exc


if __name__ == "__main__":
    main()
