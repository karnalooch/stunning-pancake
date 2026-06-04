#!/usr/bin/env python3
"""Verify documentation i18n pairs from docs/locales/i18n_manifest.json."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MANIFEST = REPO / "docs" / "locales" / "i18n_manifest.json"
LANG_RE = re.compile(r"\|\s*\*\*lang\*\*\s*\|\s*(en|pl)\s*\|", re.I)
TRANSLATION_RE = re.compile(r"\|\s*\*\*translation\*\*\s*\|\s*\[", re.I)
TRANSLATION_STATUS_RE = re.compile(
    r"\|\s*\*\*translation_status\*\*\s*\|\s*(reviewed|machine-translated)\s*\|",
    re.I,
)
STUB_MARKER = re.compile(r"i18n:\s*translate body from", re.I)

# P0 operations runbooks — enterprise reviewed EN/PL pair required in CI
P0_OPS_REVIEWED = {
    "docs/pl/operations/RAILWAY_PRODUCTION_CHECKLIST.md",
    "docs/en/operations/RAILWAY_PRODUCTION_CHECKLIST.md",
    "docs/pl/operations/RAILWAY_CELERY_MEMORY.md",
    "docs/en/operations/RAILWAY_CELERY_MEMORY.md",
    "docs/pl/operations/SIMULATOR.md",
    "docs/en/operations/SIMULATOR.md",
    "docs/pl/operations/LIVE_MAP.md",
    "docs/en/operations/LIVE_MAP.md",
    "docs/pl/operations/TELEMETRY_LOAD_TEST.md",
    "docs/en/operations/TELEMETRY_LOAD_TEST.md",
}


def load_entries() -> list[dict]:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return data["entries"]


def check_file(path: Path, expect_lang: str | None) -> list[str]:
    errors: list[str] = []
    rel = path.relative_to(REPO).as_posix()
    if not path.is_file():
        return [f"missing: {rel}"]
    text = path.read_text(encoding="utf-8")
    if expect_lang:
        m = LANG_RE.search(text)
        if not m:
            errors.append(f"{rel}: missing | **lang** |")
        elif m.group(1).lower() != expect_lang:
            errors.append(f"{rel}: lang={m.group(1)} expected {expect_lang}")
    if expect_lang and not TRANSLATION_RE.search(text):
        errors.append(f"{rel}: missing | **translation** |")
    if rel in P0_OPS_REVIEWED:
        sm = TRANSLATION_STATUS_RE.search(text)
        if not sm:
            errors.append(f"{rel}: missing | **translation_status** | (reviewed or machine-translated)")
        elif sm.group(1).lower() != "reviewed":
            errors.append(f"{rel}: translation_status={sm.group(1)} expected reviewed")
    return errors


def main() -> int:
    if not MANIFEST.is_file():
        print(f"Missing {MANIFEST} — run scripts/docs_i18n_manifest.py")
        return 1

    errors: list[str] = []
    stubs: list[str] = []
    paired = en_only = 0

    for entry in load_entries():
        mode = entry["mode"]
        if mode in ("n/a", "legacy_redirect"):
            continue
        if mode == "en_only":
            en_only += 1
            en_path = REPO / entry["en"]
            errors.extend(check_file(en_path, "en"))
            pl_rel = entry.get("pl")
            if pl_rel:
                pl_path = REPO / pl_rel
                if pl_path.is_file():
                    errors.extend(check_file(pl_path, "pl"))
                    if STUB_MARKER.search(pl_path.read_text(encoding="utf-8")):
                        stubs.append(pl_rel)
            continue

        if mode == "paired":
            paired += 1
            pl_path = REPO / entry["pl"]
            en_path = REPO / entry["en"]
            errors.extend(check_file(pl_path, "pl"))
            errors.extend(check_file(en_path, "en"))
            if en_path.is_file() and STUB_MARKER.search(en_path.read_text(encoding="utf-8")):
                stubs.append(entry["en"])
            if pl_path.is_file() and STUB_MARKER.search(pl_path.read_text(encoding="utf-8")):
                stubs.append(entry["pl"])

    if errors:
        print("Documentation i18n check failed:\n")
        for err in errors:
            print(f"  {err}")
        return 1

    print(
        f"OK: {paired} paired + {en_only} en_only entries; "
        f"lang/translation metadata present."
    )
    if stubs:
        print(f"Note: {len(stubs)} mirror(s) still have translation stub marker (non-blocking).")
        for s in stubs[:10]:
            print(f"  - {s}")
        if len(stubs) > 10:
            print(f"  ... and {len(stubs) - 10} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
