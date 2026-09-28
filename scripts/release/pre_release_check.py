from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PILOT_EVIDENCE = ROOT / "docs" / "security" / "PILOT_RELEASE_EVIDENCE.json"

REQUIRED_FILES = [
    "docs/reports/RELIABILITY_AUDIT_PLAYBOOK.md",
    "docs/operations/PRE_RELEASE_VERIFICATION.md",
    "docs/compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md",
    "infrastructure/k8s/kustomization.yaml",
]

REQUIRED_K8S_MANIFESTS = [
    "infrastructure/k8s/namespace.yaml",
    "infrastructure/k8s/config/app-configmap.yaml",
    "infrastructure/k8s/config/app-secrets.template.yaml",
    "infrastructure/k8s/workloads/api.yaml",
    "infrastructure/k8s/workloads/worker.yaml",
    "infrastructure/k8s/workloads/worker-simulation.yaml",
    "infrastructure/k8s/workloads/beat.yaml",
    "infrastructure/k8s/workloads/redis.yaml",
    "infrastructure/k8s/workloads/brouter.yaml",
    "infrastructure/k8s/network/ingress.yaml",
]

REQUIRED_PILOT_EVIDENCE = (
    "t28_security_inventory",
    "t57_business_recovery",
    "t68_signing_key_closure",
    "t75_transport_backup",
    "t76_android_chaos",
    "t84_physical_android_ui",
    "t85_tenant_admin_smoke",
    "t86_global_owner_smoke",
    "t87_operator_gate",
    "t90_dev_env_ready",
)

ALLOWED_EVIDENCE_STATUSES = {
    "PASS",
    "FAIL",
    "BLOCKED",
    "PARTIAL",
    "PLANNED",
    "UNKNOWN",
    "NOT_RUN",
}


def check_files(paths: list[str], root: Path = ROOT) -> tuple[bool, list[str]]:
    missing = [path for path in paths if not (root / path).exists()]
    return (len(missing) == 0, missing)


def artifact_gate_errors(root: Path = ROOT) -> list[str]:
    _ok_docs, missing_docs = check_files(REQUIRED_FILES, root)
    _ok_manifests, missing_manifests = check_files(REQUIRED_K8S_MANIFESTS, root)
    return [
        *(f"missing release gate file: {path}" for path in missing_docs),
        *(f"missing Kubernetes manifest: {path}" for path in missing_manifests),
    ]


def load_pilot_evidence(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ValueError(f"pilot evidence manifest is missing: {path}")
    try:
        decoded = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"pilot evidence manifest is invalid JSON: {path}") from exc
    if not isinstance(decoded, dict):
        raise ValueError("pilot evidence manifest must be a JSON object")
    return decoded


def evaluate_pilot_evidence(document: dict[str, Any]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    blockers: list[str] = []

    if document.get("schema_version") != 1:
        errors.append("pilot evidence schema_version must equal 1")

    evidence = document.get("evidence")
    if not isinstance(evidence, dict):
        return [*errors, "pilot evidence 'evidence' must be an object"], blockers

    for key in REQUIRED_PILOT_EVIDENCE:
        item = evidence.get(key)
        if not isinstance(item, dict):
            errors.append(f"{key}: missing evidence object")
            continue

        status = item.get("status")
        if status not in ALLOWED_EVIDENCE_STATUSES:
            errors.append(f"{key}: invalid status {status!r}")
            continue

        refs = item.get("evidence")
        if (
            not isinstance(refs, list)
            or not refs
            or any(not isinstance(ref, str) or not ref.strip() for ref in refs)
        ):
            errors.append(f"{key}: evidence must be a non-empty list of references")

        if status != "PASS":
            blockers.append(f"{key}: {status}")

    return errors, blockers


def current_git_sha(root: Path = ROOT) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    sha = result.stdout.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError(f"invalid Git SHA returned by checkout: {sha!r}")
    return sha


def build_pilot_report(
    document: dict[str, Any],
    *,
    git_sha: str,
    manifest_path: Path,
    errors: list[str],
    blockers: list[str],
) -> dict[str, Any]:
    evidence = document.get("evidence")
    statuses: dict[str, str] = {}
    if isinstance(evidence, dict):
        for key in REQUIRED_PILOT_EVIDENCE:
            item = evidence.get(key)
            if isinstance(item, dict) and isinstance(item.get("status"), str):
                statuses[key] = item["status"]

    return {
        "schema_version": 1,
        "gate": "t58-pilot-release",
        "result": "PASS" if not errors and not blockers else "NO-GO",
        "git_sha": git_sha,
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "manifest": str(manifest_path),
        "required_evidence": statuses,
        "errors": errors,
        "blockers": blockers,
    }


def write_report(report: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def run_artifact_gate(root: Path = ROOT) -> int:
    ok_docs, missing_docs = check_files(REQUIRED_FILES, root)
    ok_manifests, missing_manifests = check_files(REQUIRED_K8S_MANIFESTS, root)

    if not ok_docs:
        print("Missing release gate files:")
        for path in missing_docs:
            print(f"- {path}")

    if not ok_manifests:
        print("Missing Kubernetes manifest files:")
        for path in missing_manifests:
            print(f"- {path}")

    if ok_docs and ok_manifests:
        print("Pre-release gate artifacts present.")
        return 0

    return 1


def run_pilot_gate(evidence_path: Path, report_path: Path | None = None) -> int:
    errors = artifact_gate_errors()
    blockers: list[str] = []
    document: dict[str, Any] = {}

    try:
        document = load_pilot_evidence(evidence_path)
    except ValueError as exc:
        errors.append(str(exc))
    else:
        evidence_errors, evidence_blockers = evaluate_pilot_evidence(document)
        errors.extend(evidence_errors)
        blockers.extend(evidence_blockers)

    try:
        sha = current_git_sha()
    except (subprocess.CalledProcessError, ValueError) as exc:
        errors.append(f"could not bind T58 report to Git HEAD: {exc}")
        sha = "UNKNOWN"

    report = build_pilot_report(
        document,
        git_sha=sha,
        manifest_path=evidence_path,
        errors=errors,
        blockers=blockers,
    )

    if report_path is not None:
        write_report(report, report_path)
        print(f"T58 evidence report: {report_path}")

    if errors:
        print("T58 pilot release gate errors:")
        for error in errors:
            print(f"- {error}")

    if blockers:
        print("T58 pilot release blockers:")
        for blocker in blockers:
            print(f"- {blocker}")

    if report["result"] == "PASS":
        print(f"T58 PILOT RELEASE GATE PASS: {sha}")
        return 0

    print(f"T58 PILOT RELEASE GATE NO-GO: {sha}")
    return 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="4VELO pre-release verification gate")
    parser.add_argument(
        "--pilot",
        action="store_true",
        help="enforce the fail-closed T58 pilot evidence manifest",
    )
    parser.add_argument(
        "--evidence-file",
        type=Path,
        default=DEFAULT_PILOT_EVIDENCE,
        help="T58 pilot evidence manifest (used with --pilot)",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="write a secret-free machine-readable T58 report (used with --pilot)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.report is not None and not args.pilot:
        print("--report is only valid with --pilot", file=sys.stderr)
        return 2
    if args.pilot:
        return run_pilot_gate(args.evidence_file.resolve(), args.report)
    return run_artifact_gate()


if __name__ == "__main__":
    sys.exit(main())
