#!/usr/bin/env python3
"""Merge per-step JSON reports into a final suite report."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_LOAD_ROOT = Path(__file__).resolve().parent
if str(_LOAD_ROOT) not in sys.path:
    sys.path.insert(0, str(_LOAD_ROOT))

from lib.report import build_report, evaluate_thresholds, merge_reports, validate_report  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", required=True)
    parser.add_argument("--tier", required=True)
    parser.add_argument("--started-at", required=True)
    parser.add_argument("--finished-at", required=True)
    parser.add_argument("--ingest-url", required=True)
    parser.add_argument("--map-url", required=True)
    parser.add_argument("--target", default="local-docker")
    parser.add_argument("--preflight-pass", action="store_true")
    parser.add_argument("--partials-file", default="")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    partials: list[dict] = []
    if args.partials_file:
        for line in Path(args.partials_file).read_text(encoding="utf-8").splitlines():
            path = Path(line.strip())
            if path.is_file():
                partials.append(json.loads(path.read_text(encoding="utf-8")))

    preflight = {"pass": args.preflight_pass, "checks": []}
    if partials:
        report = merge_reports(partials, suite=args.suite, tier=args.tier)
        report["preflight"] = preflight
        report["started_at"] = args.started_at
        report["finished_at"] = args.finished_at
        report["environment"] = {
            "target": args.target,
            "ingest_url": args.ingest_url,
            "map_url": args.map_url,
        }
    else:
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
