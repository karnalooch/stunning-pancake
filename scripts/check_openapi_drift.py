#!/usr/bin/env python3
"""
Lightweight OpenAPI drift guard (Q-P1-3).

Compares critical API paths documented in docs/API.md against a static manifest.
Extend CRITICAL_PATHS when adding admin/sim APIs.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
API_DOC = REPO / "docs" / "API.md"
URLS_PY = REPO / "backend" / "core" / "urls.py"

CRITICAL_PATHS = [
    "/api/auth/token/",
    "/api/auth/token/refresh/",
    "/api/users/profile/",
    "/api/users/register/",
    "/api/activities/sessions/",
    "/api/activities/admin/sim-capacity/",
    "/api/activities/admin/scale-preflight/",
    "/api/activities/admin/disk-audit/",
    "/api/infra/health/",
]


def paths_in_api_md(text: str) -> set[str]:
    found: set[str] = set()
    for match in re.finditer(r"(?:GET|POST|PUT|PATCH|DELETE)\s+(/api/[^\s`|]+)", text):
        found.add(_norm(match.group(1)))
    for match in re.finditer(r"`(/api/[^`]+)`", text):
        found.add(_norm(match.group(1).split("{", 1)[0]))

    current_base = ""
    for line in text.splitlines():
        base_match = re.match(r"### Base URL: `(/api/[^`]+)`", line)
        if base_match:
            current_base = base_match.group(1).rstrip("/")
            continue
        row_match = re.match(r"\| `(/[^`|]+)` \|", line)
        if row_match and current_base:
            ep = row_match.group(1).split("<", 1)[0]
            found.add(_norm(f"{current_base}{ep}"))

    return found


def _norm(path: str) -> str:
    p = path.split("#", 1)[0].strip()
    if not p.endswith("/"):
        p += "/"
    return p


def main() -> int:
    if not API_DOC.is_file():
        print(f"Missing {API_DOC}")
        return 1

    doc_text = API_DOC.read_text(encoding="utf-8")
    documented = paths_in_api_md(doc_text)
    missing = [path for path in CRITICAL_PATHS if _norm(path) not in documented]

    if missing:
        print("OpenAPI/docs drift — paths missing from docs/API.md:\n")
        for p in missing:
            print(f"  {p}")
        print("\nUpdate docs/API.md or CRITICAL_PATHS in scripts/check_openapi_drift.py")
        return 1

    if not URLS_PY.is_file():
        print(f"WARN: {URLS_PY} not found; doc-only check passed")
    else:
        urls_text = URLS_PY.read_text(encoding="utf-8")
        if "telemetry" not in urls_text.lower() and "ingest" not in urls_text.lower():
            print("WARN: backend urls may not wire telemetry proxy — manual Swagger check advised")

    print(f"OK — {len(CRITICAL_PATHS)} critical paths present in docs/API.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
