#!/usr/bin/env python3
"""T92 exact-SHA pre-pilot regression evidence helper."""

from __future__ import annotations

import argparse
import json
import re
from datetime import UTC, datetime
from pathlib import Path

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
REQUIRED_LANES = ("preflight", "exact_regression", "full_release")


class T92Error(RuntimeError):
    """Raised when T92 evidence cannot be accepted."""


def validate_candidate_sha(value: str) -> str:
    candidate = value.strip()
    if not SHA_RE.fullmatch(candidate):
        raise T92Error("candidate SHA must be exactly 40 lowercase hexadecimal characters")
    return candidate


def build_evidence(
    *,
    candidate_sha: str,
    workflow_run_id: str,
    repository: str,
    lane_results: dict[str, str],
    operator_reason: str = "",
) -> dict:
    candidate = validate_candidate_sha(candidate_sha)
    missing = [lane for lane in REQUIRED_LANES if lane not in lane_results]
    if missing:
        raise T92Error("missing T92 lane result(s): " + ", ".join(missing))

    normalized = {lane: str(lane_results[lane]).strip().lower() for lane in REQUIRED_LANES}
    invalid = {lane: result for lane, result in normalized.items() if not result}
    if invalid:
        raise T92Error("T92 lane results must be non-empty")

    overall = "PASS" if all(result == "success" for result in normalized.values()) else "FAIL"
    return {
        "schema_version": 1,
        "tranche": "T92",
        "contract": "full-pre-pilot-regression-exact-sha",
        "overall_status": overall,
        "candidate_sha": candidate,
        "repository": repository.strip(),
        "workflow_run_id": str(workflow_run_id).strip(),
        "operator_reason": operator_reason.strip() or None,
        "t94_selective_execution_used": False,
        "deployment_performed": False,
        "lane_results": normalized,
        "completed_at_utc": datetime.now(UTC).isoformat(),
    }


def write_evidence(path: Path, evidence: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    validate = sub.add_parser("validate-sha")
    validate.add_argument("--candidate-sha", required=True)

    write = sub.add_parser("write-evidence")
    write.add_argument("--candidate-sha", required=True)
    write.add_argument("--workflow-run-id", required=True)
    write.add_argument("--repository", required=True)
    write.add_argument("--preflight-result", required=True)
    write.add_argument("--exact-regression-result", required=True)
    write.add_argument("--full-release-result", required=True)
    write.add_argument("--operator-reason", default="")
    write.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.command == "validate-sha":
            candidate = validate_candidate_sha(args.candidate_sha)
            print(f"T92 candidate SHA syntax PASS: {candidate}")
            return 0

        evidence = build_evidence(
            candidate_sha=args.candidate_sha,
            workflow_run_id=args.workflow_run_id,
            repository=args.repository,
            operator_reason=args.operator_reason,
            lane_results={
                "preflight": args.preflight_result,
                "exact_regression": args.exact_regression_result,
                "full_release": args.full_release_result,
            },
        )
        write_evidence(args.output, evidence)
        print(f"T92 evidence {evidence['overall_status']}: {args.output}")
        return 0 if evidence["overall_status"] == "PASS" else 1
    except T92Error as exc:
        print(f"T92 evidence error: {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
