#!/usr/bin/env python3
"""Finalize a suite JSON report from step outputs (used by run-suite.ps1)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_LOAD_ROOT = Path(__file__).resolve().parent
if str(_LOAD_ROOT) not in sys.path:
    sys.path.insert(0, str(_LOAD_ROOT))

from lib.report import build_report, evaluate_thresholds, validate_report  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", required=True)
    parser.add_argument("--tier", required=True)
    parser.add_argument("--started-at", required=True)
    parser.add_argument("--finished-at", required=True)
    parser.add_argument("--ingest-url", required=True)
    parser.add_argument("--map-url", required=True)
    parser.add_argument("--target", default="local-docker")
    parser.add_argument("--tools-json", required=True)
    parser.add_argument("--metrics-json", required=True)
    parser.add_argument("--preflight-json", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    tools = json.loads(args.tools_json)
    metrics = json.loads(args.metrics_json)
    preflight = json.loads(args.preflight_json)

    report = build_report(
        suite=args.suite,
        tier=args.tier,
        started_at=args.started_at,
        finished_at=args.finished_at,
        environment={
            "target": args.target,
            "ingest_url": args.ingest_url,
            "map_url": args.map_url,
        },
        tools=tools,
        metrics=metrics,
        preflight=preflight,
    )
    report["threshold_evaluation"] = evaluate_thresholds(report, args.tier)
    errors = validate_report(report)
    if errors:
        report["validation_errors"] = errors

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(out)
    print("PASS" if report["threshold_evaluation"]["pass"] else "FAIL")
    return 0 if report["threshold_evaluation"]["pass"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
