"""Unified load-test report builder, validator, merger, and threshold evaluator."""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

_SCHEMA_VERSION = "1"
_REQUIRED_KEYS = (
    "schema_version",
    "suite",
    "tier",
    "started_at",
    "finished_at",
    "environment",
    "tools",
    "metrics",
    "threshold_evaluation",
)


def _utc_now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def _error_rate(errors: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return errors / total


def build_report(
    *,
    suite: str,
    tier: str,
    environment: dict[str, Any] | None = None,
    tools: list[dict[str, Any]] | None = None,
    metrics: dict[str, Any] | None = None,
    threshold_evaluation: dict[str, Any] | None = None,
    started_at: str | None = None,
    finished_at: str | None = None,
    preflight: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Construct a report dict compatible with report_schema.json v1."""
    report: dict[str, Any] = {
        "schema_version": _SCHEMA_VERSION,
        "suite": suite,
        "tier": tier,
        "started_at": started_at or _utc_now_iso(),
        "finished_at": finished_at or _utc_now_iso(),
        "environment": environment or {"target": "local"},
        "tools": tools or [],
        "metrics": metrics or {},
        "threshold_evaluation": threshold_evaluation
        or {"tier": tier, "pass": True, "checks": []},
    }
    if preflight is not None:
        report["preflight"] = preflight
    return report


def validate_report(report: dict[str, Any]) -> list[str]:
    """Return a list of validation errors; empty list means valid."""
    errors: list[str] = []
    if not isinstance(report, dict):
        return ["report must be a JSON object"]

    for key in _REQUIRED_KEYS:
        if key not in report:
            errors.append(f"missing required key: {key}")

    if report.get("schema_version") != _SCHEMA_VERSION:
        errors.append(f"schema_version must be {_SCHEMA_VERSION!r}")

    for key in ("suite", "tier", "started_at", "finished_at"):
        if key in report and not isinstance(report[key], str):
            errors.append(f"{key} must be a string")

    if "environment" in report and not isinstance(report["environment"], dict):
        errors.append("environment must be an object")

    if "tools" in report:
        if not isinstance(report["tools"], list):
            errors.append("tools must be an array")
        else:
            for idx, tool in enumerate(report["tools"]):
                if not isinstance(tool, dict) or "name" not in tool:
                    errors.append(f"tools[{idx}] must be an object with name")

    if "metrics" in report and not isinstance(report["metrics"], dict):
        errors.append("metrics must be an object")

    te = report.get("threshold_evaluation")
    if te is not None:
        if not isinstance(te, dict):
            errors.append("threshold_evaluation must be an object")
        else:
            if "tier" not in te or "pass" not in te:
                errors.append("threshold_evaluation requires tier and pass")
            if "pass" in te and not isinstance(te["pass"], bool):
                errors.append("threshold_evaluation.pass must be boolean")

    return errors


def merge_reports(reports: list[dict[str, Any]], *, suite: str, tier: str) -> dict[str, Any]:
    """Merge per-tool reports into one suite report."""
    if not reports:
        raise ValueError("merge_reports requires at least one report")

    started = min(r.get("started_at", _utc_now_iso()) for r in reports)
    finished = max(r.get("finished_at", _utc_now_iso()) for r in reports)

    tools: list[dict[str, Any]] = []
    metrics: dict[str, Any] = {}
    environments: list[dict[str, Any]] = []
    preflight_checks: list[dict[str, Any]] = []
    preflight_pass = True

    for report in reports:
        tools.extend(report.get("tools", []))
        for section, values in report.get("metrics", {}).items():
            if section not in metrics:
                metrics[section] = deepcopy(values)
            else:
                existing = metrics[section]
                for key, value in values.items():
                    if key == "latency_ms" and isinstance(value, dict):
                        lat = existing.setdefault("latency_ms", {})
                        for pct, ms in value.items():
                            lat[pct] = max(lat.get(pct, 0), ms)
                    elif isinstance(value, (int, float)) and isinstance(
                        existing.get(key), (int, float)
                    ):
                        existing[key] = existing[key] + value
                    else:
                        existing[key] = value
        env = report.get("environment")
        if isinstance(env, dict):
            environments.append(env)
        pf = report.get("preflight")
        if isinstance(pf, dict):
            preflight_pass = preflight_pass and bool(pf.get("pass", True))
            preflight_checks.extend(pf.get("checks", []))

    environment = environments[0] if len(environments) == 1 else {"targets": environments}
    merged = build_report(
        suite=suite,
        tier=tier,
        started_at=started,
        finished_at=finished,
        environment=environment,
        tools=tools,
        metrics=metrics,
    )
    if preflight_checks or any("preflight" in r for r in reports):
        merged["preflight"] = {"pass": preflight_pass, "checks": preflight_checks}
    merged["merged_from"] = [r.get("suite", "unknown") for r in reports]
    merged["threshold_evaluation"] = evaluate_thresholds(merged, tier)
    return merged


def evaluate_thresholds(
    report: dict[str, Any],
    tier: str,
    thresholds_path: Path | None = None,
) -> dict[str, Any]:
    """Evaluate report metrics against thresholds.json for *tier*."""
    root = Path(__file__).resolve().parent.parent
    path = thresholds_path or (root / "thresholds.json")
    data = _load_json(path)
    tier_cfg = data.get("tiers", {}).get(tier)
    if tier_cfg is None:
        return {
            "tier": tier,
            "pass": False,
            "checks": [
                {
                    "name": "tier_defined",
                    "pass": False,
                    "expected": "known tier",
                    "actual": tier,
                    "message": f"unknown tier: {tier}",
                }
            ],
        }

    metrics = report.get("metrics", {})
    checks: list[dict[str, Any]] = []

    ingest = metrics.get("ingest", {})
    if "ingest_positions_per_second_min" in tier_cfg:
        actual_pps = float(ingest.get("positions_per_second", 0))
        expected = tier_cfg["ingest_positions_per_second_min"]
        checks.append(
            {
                "name": "ingest_positions_per_second",
                "pass": actual_pps >= expected,
                "expected": f">= {expected}",
                "actual": actual_pps,
                "message": f"ingest pps {actual_pps:.1f} vs min {expected}",
            }
        )

    map_metrics = metrics.get("map", {})
    if "map_p95_ms_max" in tier_cfg and map_metrics:
        actual_p95 = float(map_metrics.get("latency_ms", {}).get("p95", 0))
        expected = tier_cfg["map_p95_ms_max"]
        checks.append(
            {
                "name": "map_p95_ms",
                "pass": actual_p95 <= expected if actual_p95 > 0 else True,
                "expected": f"<= {expected}",
                "actual": actual_p95,
                "message": f"map p95 {actual_p95:.1f} ms vs max {expected}",
            }
        )

    max_err = tier_cfg.get("error_rate_max")
    if max_err is not None:
        ingest_total = int(ingest.get("accepted", 0)) + int(ingest.get("errors", 0))
        ingest_err = _error_rate(int(ingest.get("errors", 0)), ingest_total)
        if ingest_total > 0:
            checks.append(
                {
                    "name": "ingest_error_rate",
                    "pass": ingest_err <= max_err,
                    "expected": f"<= {max_err}",
                    "actual": ingest_err,
                    "message": f"ingest error rate {ingest_err:.4f}",
                }
            )
        map_total = int(map_metrics.get("ok", 0)) + int(map_metrics.get("errors", 0))
        map_err = _error_rate(int(map_metrics.get("errors", 0)), map_total)
        if map_total > 0:
            checks.append(
                {
                    "name": "map_error_rate",
                    "pass": map_err <= max_err,
                    "expected": f"<= {max_err}",
                    "actual": map_err,
                    "message": f"map error rate {map_err:.4f}",
                }
            )

    passed = all(c["pass"] for c in checks) if checks else True
    return {"tier": tier, "pass": passed, "checks": checks}


def ingest_metrics_from_counters(
    *,
    duration_s: float,
    batch_size: int,
    accepted: int,
    throttled: int,
    errors: int,
    latency_ms: dict[str, float],
) -> dict[str, Any]:
    """Build ingest metrics block from harness counters."""
    elapsed = duration_s if duration_s > 0 else 1.0
    positions = accepted * batch_size
    total = accepted + errors
    return {
        "positions_per_second": positions / elapsed,
        "requests_per_second": accepted / elapsed,
        "latency_ms": latency_ms,
        "accepted": accepted,
        "throttled": throttled,
        "errors": errors,
        "error_rate": _error_rate(errors, total),
    }


def map_metrics_from_counters(
    *,
    ok: int,
    errors: int,
    latency_ms: dict[str, float],
) -> dict[str, Any]:
    """Build map metrics block from harness counters."""
    total = ok + errors
    return {
        "latency_ms": latency_ms,
        "ok": ok,
        "errors": errors,
        "error_rate": _error_rate(errors, total),
    }
