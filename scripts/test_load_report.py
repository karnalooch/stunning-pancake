"""Unit tests for scripts/load/lib/report.py."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

_LOAD_ROOT = Path(__file__).resolve().parent / "load"
if str(_LOAD_ROOT) not in sys.path:
    sys.path.insert(0, str(_LOAD_ROOT))

from lib.report import (  # noqa: E402
    build_report,
    evaluate_thresholds,
    merge_reports,
    validate_report,
)


@pytest.fixture
def thresholds_path() -> Path:
    return _LOAD_ROOT / "thresholds.json"


def test_build_report_has_required_fields() -> None:
    report = build_report(suite="smoke", tier="smoke")
    assert report["schema_version"] == "1"
    assert report["suite"] == "smoke"
    assert report["tier"] == "smoke"
    assert "threshold_evaluation" in report


def test_validate_report_ok() -> None:
    report = build_report(suite="smoke", tier="smoke")
    assert validate_report(report) == []


def test_validate_report_missing_key() -> None:
    report = build_report(suite="smoke", tier="smoke")
    del report["metrics"]
    errors = validate_report(report)
    assert any("metrics" in e for e in errors)


def test_validate_report_bad_schema_version() -> None:
    report = build_report(suite="smoke", tier="smoke")
    report["schema_version"] = "99"
    errors = validate_report(report)
    assert any("schema_version" in e for e in errors)


def test_evaluate_thresholds_smoke_pass(thresholds_path: Path) -> None:
    report = build_report(
        suite="smoke",
        tier="smoke",
        metrics={
            "ingest": {
                "positions_per_second": 1000,
                "accepted": 100,
                "errors": 0,
                "error_rate": 0.0,
            }
        },
    )
    result = evaluate_thresholds(report, "smoke", thresholds_path=thresholds_path)
    assert result["pass"] is True
    assert result["tier"] == "smoke"


def test_evaluate_thresholds_smoke_fail_ingest(thresholds_path: Path) -> None:
    report = build_report(
        suite="smoke",
        tier="smoke",
        metrics={
            "ingest": {
                "positions_per_second": 10,
                "accepted": 1,
                "errors": 0,
                "error_rate": 0.0,
            }
        },
    )
    result = evaluate_thresholds(report, "smoke", thresholds_path=thresholds_path)
    assert result["pass"] is False
    names = {c["name"] for c in result["checks"]}
    assert "ingest_positions_per_second" in names


def test_evaluate_thresholds_map_p95(thresholds_path: Path) -> None:
    report = build_report(
        suite="baseline",
        tier="baseline",
        metrics={
            "ingest": {"positions_per_second": 6000, "accepted": 100, "errors": 0},
            "map": {
                "latency_ms": {"p95": 1500},
                "ok": 100,
                "errors": 0,
            },
        },
    )
    result = evaluate_thresholds(report, "baseline", thresholds_path=thresholds_path)
    map_check = next(c for c in result["checks"] if c["name"] == "map_p95_ms")
    assert map_check["pass"] is False


def test_merge_reports_combines_metrics() -> None:
    a = build_report(
        suite="step-a",
        tier="smoke",
        metrics={"ingest": {"accepted": 10, "errors": 0, "positions_per_second": 500}},
    )
    b = build_report(
        suite="step-b",
        tier="smoke",
        metrics={"map": {"ok": 20, "errors": 1, "latency_ms": {"p95": 200}}},
    )
    merged = merge_reports([a, b], suite="smoke", tier="smoke")
    assert merged["suite"] == "smoke"
    assert merged["metrics"]["ingest"]["accepted"] == 10
    assert merged["metrics"]["map"]["ok"] == 20
    assert "merged_from" in merged
    assert validate_report(merged) == []


def test_thresholds_json_loads() -> None:
    data = json.loads((_LOAD_ROOT / "thresholds.json").read_text(encoding="utf-8"))
    assert "smoke" in data["tiers"]
    assert "stress-50k" in data["tiers"]
