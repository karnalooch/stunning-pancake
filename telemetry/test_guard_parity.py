"""Parity contract: telemetry evaluate_ingest vs shared JSON vectors (Django mirror in backend)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ingest_guard import evaluate_ingest

_REPO_ROOT = Path(__file__).resolve().parents[1]
_VECTORS_PATH = _REPO_ROOT / "tests" / "fixtures" / "ingest_guard_parity.json"


def _load_vectors() -> list[dict]:
    with _VECTORS_PATH.open(encoding="utf-8") as f:
        return json.load(f)


@pytest.mark.parametrize("case", _load_vectors(), ids=lambda c: c["name"])
def test_evaluate_ingest_matches_parity_vectors(case: dict) -> None:
    count = int(case["count"])
    mode = case["mode"]
    limit = int(case["limit"])
    was_engaged = bool(case["was_engaged"])
    engage_ratio = float(case.get("engage_ratio", 0.9))
    expected = case["expected"]

    result = evaluate_ingest(
        count,
        mode=mode,
        limit=limit,
        was_engaged=was_engaged,
        engage_ratio_val=engage_ratio,
    )

    assert result.allowed == expected["allowed"]
    assert result.engaged == expected["engaged"]
    if "retry_after" in expected:
        assert result.retry_after == expected["retry_after"]
    if expected.get("retry_after_min"):
        assert result.retry_after >= expected["retry_after_min"]
