#!/usr/bin/env python3
"""Fail when explicitly current documentation exceeds its review SLA."""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CONFIG = REPO / "docs" / "DOCUMENTATION_FRESHNESS.json"
LAST_REVIEWED_RE = re.compile(r"\|\s*\*\*Last reviewed\*\*\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|", re.I)


def extract_last_reviewed(text: str) -> date | None:
    match = LAST_REVIEWED_RE.search(text)
    if not match:
        return None
    return date.fromisoformat(match.group(1))


def check_document(path: Path, *, max_age_days: int, today: date) -> list[str]:
    if not path.is_file():
        return [f"missing current document: {path}"]
    reviewed = extract_last_reviewed(path.read_text(encoding="utf-8"))
    if reviewed is None:
        return [f"{path}: missing Last reviewed metadata"]
    if reviewed > today:
        return [f"{path}: Last reviewed {reviewed.isoformat()} is in the future"]
    age = (today - reviewed).days
    if age > max_age_days:
        return [
            f"{path}: stale current document — reviewed {age} days ago; SLA is {max_age_days} days"
        ]
    return []


def load_config(path: Path = CONFIG) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    data = load_config()
    errors: list[str] = []
    today = date.today()
    documents = data.get("documents", [])
    for item in documents:
        rel = item["path"]
        max_age_days = int(item["max_age_days"])
        errors.extend(check_document(REPO / rel, max_age_days=max_age_days, today=today))

    if errors:
        print("Documentation freshness check failed:\n")
        for error in errors:
            print(f"  {error}")
        return 1

    print(f"OK — {len(documents)} current documents are within review SLA")
    return 0


if __name__ == "__main__":
    sys.exit(main())
