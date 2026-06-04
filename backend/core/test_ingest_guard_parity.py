"""Parity contract: Django load_guard ingest signal vs shared JSON vectors."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from django.test import SimpleTestCase

pytestmark = pytest.mark.simulator_light

_REPO_ROOT = Path(__file__).resolve().parents[2]
_VECTORS_PATH = _REPO_ROOT / "tests" / "fixtures" / "ingest_guard_parity.json"

from core.load_guard import SIGNAL_INGEST, evaluate_signal


def _load_vectors() -> list[dict]:
    with _VECTORS_PATH.open(encoding="utf-8") as f:
        return json.load(f)


class IngestGuardParityTest(SimpleTestCase):
    def test_evaluate_signal_matches_parity_vectors(self):
        for case in _load_vectors():
            with self.subTest(case=case["name"]):
                result = evaluate_signal(
                    SIGNAL_INGEST,
                    int(case["count"]),
                    mode=case["mode"],
                    limit=int(case["limit"]),
                    was_engaged=bool(case["was_engaged"]),
                    engage_ratio_val=float(case.get("engage_ratio", 0.9)),
                )
                expected = case["expected"]
                self.assertEqual(result.allowed, expected["allowed"])
                self.assertEqual(result.engaged, expected["engaged"])
                if "retry_after" in expected:
                    self.assertEqual(result.retry_after, expected["retry_after"])
                if expected.get("retry_after_min"):
                    self.assertGreaterEqual(result.retry_after, expected["retry_after_min"])
