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

import home_lab

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "backups" / "home-lab" / "evidence"
HOME_ENV = home_lab.ENV_FILE
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


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _full_git_sha(value: object, field: str) -> str:
    if not isinstance(value, str):
        raise T76Error(f"Runtime artifact {field} must be a Git SHA string")
    normalized = value.strip().lower()
    if len(normalized) != 40 or any(ch not in "0123456789abcdef" for ch in normalized):
        raise T76Error(f"Runtime artifact {field} must be a full 40-character Git SHA")
    return normalized


def validate_runtime_artifact(artifact_dir: Path, repo_sha: str) -> dict:
    root = artifact_dir.expanduser().resolve()
    manifest_path = root / "manifest.json"
    apk_path = root / "app-release.apk"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise T76Error(f"Cannot read runtime artifact manifest: {manifest_path}") from exc
    if not isinstance(manifest, dict):
        raise T76Error("Runtime artifact manifest must be a JSON object")
    if not apk_path.is_file():
        raise T76Error(f"Runtime artifact is missing APK: {apk_path}")

    source_sha = _full_git_sha(manifest.get("sourceHeadSha"), "sourceHeadSha")
    built_sha = _full_git_sha(manifest.get("builtGitSha"), "builtGitSha")
    expected_sha = repo_sha.strip().lower()
    if source_sha != expected_sha or built_sha != expected_sha:
        raise T76Error(
            "Runtime artifact source does not match the checked-out candidate: "
            f"source={source_sha} built={built_sha} repo={expected_sha}"
        )
    if manifest.get("packageId") != PACKAGE:
        raise T76Error(f"Runtime artifact packageId must be {PACKAGE}")
    if manifest.get("buildProfile") != "pilot-local":
        raise T76Error("Runtime artifact buildProfile must be pilot-local")
    if manifest.get("updatesEnabled") is not False:
        raise T76Error("Runtime artifact must have Expo updates disabled")
    if manifest.get("runtimeAcceptance") != "true":
        raise T76Error("Runtime artifact must be built with MOBILE_RUNTIME_ACCEPTANCE=true")

    expected_apk_hash = manifest.get("apkSha256")
    if (
        not isinstance(expected_apk_hash, str)
        or len(expected_apk_hash) != 64
        or any(ch not in "0123456789abcdef" for ch in expected_apk_hash.lower())
    ):
        raise T76Error("Runtime artifact apkSha256 must be a 64-character SHA-256")
    expected_apk_hash = expected_apk_hash.lower()
    local_apk_hash = sha256_file(apk_path)
    if local_apk_hash != expected_apk_hash:
        raise T76Error(
            "Runtime artifact APK hash mismatch: "
            f"manifest={expected_apk_hash} local={local_apk_hash}"
        )

    workflow_run_id = str(manifest.get("workflowRunId", "")).strip()
    if not workflow_run_id:
        raise T76Error("Runtime artifact workflowRunId is required")

    return {
        "mode": "ci-runtime-artifact",
        "source_head_sha": source_sha,
        "built_git_sha": built_sha,
        "workflow_run_id": workflow_run_id,
        "apk_sha256": expected_apk_hash,
        "package_id": PACKAGE,
        "build_profile": "pilot-local",
        "updates_enabled": False,
        "runtime_acceptance": True,
    }


def installed_apk_sha256(serial: str) -> str:
    output = adb(serial, "shell", "pm", "path", PACKAGE)
    paths = [
        line.split("package:", 1)[1].strip()
        for line in output.splitlines()
        if line.strip().startswith("package:")
    ]
    if len(paths) != 1 or not paths[0].endswith(".apk"):
        raise T76Error(
            "Exact-artifact proof requires one installed APK path; "
            f"package manager returned {len(paths)} paths"
        )

    result = subprocess.run(
        ["adb", "-s", serial, "exec-out", "cat", paths[0]],
        cwd=ROOT,
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise T76Error(
            "Cannot read installed APK bytes for exact-artifact proof; "
            f"device returned exit {result.returncode}: {detail}"
        )
    if not result.stdout:
        raise T76Error("Installed APK read returned no bytes")
    return hashlib.sha256(result.stdout).hexdigest()


def verify_installed_runtime_artifact(serial: str, provenance: dict) -> dict:
    installed_hash = installed_apk_sha256(serial)
    expected_hash = provenance["apk_sha256"]
    if installed_hash != expected_hash:
        raise T76Error(
            "Installed APK does not match the CI runtime artifact: "
            f"installed={installed_hash} expected={expected_hash}"
        )
    verified = dict(provenance)
    verified["mode"] = "ci-runtime-artifact-installed-apk-sha256"
    verified["installed_apk_sha256"] = installed_hash
    return verified


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


def new_evidence(serial: str, artifact_provenance: dict) -> dict:
    return {
        "schema_version": 2,
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
        "artifact_provenance": artifact_provenance,
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
    if evidence.get("schema_version") != 2:
        raise T76Error("T76 evidence must use schema_version=2 exact-artifact provenance")
    if set(evidence["scenarios"]) != set(SCENARIOS):
        raise T76Error("T76 evidence scenario set does not match the required matrix")
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
    provenance = evidence.get("artifact_provenance")
    if not isinstance(provenance, dict):
        raise T76Error("T76 finalization requires exact runtime artifact provenance")
    if provenance.get("mode") != "ci-runtime-artifact-installed-apk-sha256":
        raise T76Error(
            "T76 finalization requires the installed APK SHA-256 to match "
            "the exact CI runtime artifact"
        )
    if provenance.get("installed_apk_sha256") != provenance.get("apk_sha256"):
        raise T76Error("T76 installed APK hash does not match recorded runtime artifact")

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


def preflight(
    serial: str | None,
    output: Path | None,
    *,
    runtime_artifact: Path | None,
    installed_sha: str | None,
) -> Path:
    repo_sha = exact_git_sha().strip().lower()
    artifact_provenance: dict
    if runtime_artifact is not None:
        artifact_provenance = validate_runtime_artifact(runtime_artifact, repo_sha)
    else:
        assert installed_sha is not None
        if installed_sha.strip().lower() != repo_sha:
            raise T76Error(
                "Installed-build SHA attestation does not match the checked-out candidate: "
                f"installed={installed_sha.strip()} repo={repo_sha}"
            )
        artifact_provenance = {
            "mode": "operator-sha-attestation",
            "source_head_sha": repo_sha,
        }

    devices = parse_adb_devices(run_capture(["adb", "devices"]))
    selected = select_device(devices, serial)
    verify_package(selected)
    if runtime_artifact is not None:
        artifact_provenance = verify_installed_runtime_artifact(
            selected, artifact_provenance
        )
    setup_adb_reverse(selected)
    check_home_lab()

    target = (output or evidence_path()).expanduser().resolve()
    if target.exists():
        raise T76Error(f"Refusing to overwrite existing evidence: {target}")
    write_evidence(target, new_evidence(selected, artifact_provenance))
    print(f"T76 preflight PASS; evidence initialized: {target}")
    return target


def restart_service(service: str) -> None:
    if service not in FAULT_SERVICES:
        raise T76Error(f"Unsupported fault service: {service}")
    if not HOME_ENV.is_file():
        raise T76Error("Missing .env.home; initialize the home lab first")
    run_visible(home_lab.compose_command("restart", service))
    run_visible(home_lab.compose_command("up", "-d", "--wait"))
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
    provenance = pre.add_mutually_exclusive_group(required=True)
    provenance.add_argument(
        "--runtime-artifact",
        type=Path,
        help=(
            "Directory from the exact-SHA mobile-runtime CI artifact containing "
            "manifest.json and app-release.apk"
        ),
    )
    provenance.add_argument(
        "--installed-sha",
        help=(
            "Legacy/manual SHA attestation for diagnostics only; evidence created "
            "this way cannot finalize T76"
        ),
    )

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
            preflight(
                args.serial,
                args.evidence,
                runtime_artifact=args.runtime_artifact,
                installed_sha=args.installed_sha,
            )
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
