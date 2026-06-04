#!/usr/bin/env python3
"""Verify paired documentation locales listed in docs/locales/MIGRATION_REGISTRY.md."""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
REGISTRY = REPO / "docs" / "locales" / "MIGRATION_REGISTRY.md"
LANG_RE = re.compile(r"\|\s*\*\*lang\*\*\s*\|\s*(en|pl)\s*\|", re.I)
TRANSLATION_RE = re.compile(r"\|\s*\*\*translation\*\*\s*\|\s*\[", re.I)

# Rows: | LIVE_MAP.md | **paired** | PL path | EN path |
PAIRED_ROW_RE = re.compile(
    r"^\|\s*([A-Z0-9_]+\.md)\s*\|\s*\*\*paired\*\*\s*\|",
    re.MULTILINE,
)


def parse_paired_docs(registry_text: str) -> list[str]:
    """Return basenames (e.g. LIVE_MAP.md) marked **paired** in operations table."""
    names: list[str] = []
    in_ops = False
    for line in registry_text.splitlines():
        if line.startswith("## Operations"):
            in_ops = True
            continue
        if in_ops and line.startswith("## ") and "Operations" not in line:
            break
        m = PAIRED_ROW_RE.match(line)
        if m:
            names.append(m.group(1))
    return names


def resolve_doc_path(basename: str, lang: str) -> Path:
    if lang == "en":
        return REPO / "docs" / "en" / "operations" / basename
    return REPO / "docs" / "operations" / basename


def check_file(path: Path) -> list[str]:
    errors: list[str] = []
    if not path.is_file():
        return [f"missing file: {path.relative_to(REPO)}"]
    text = path.read_text(encoding="utf-8")
    if not LANG_RE.search(text):
        errors.append(f"{path.relative_to(REPO)}: missing | **lang** | in metadata")
    if not TRANSLATION_RE.search(text):
        errors.append(f"{path.relative_to(REPO)}: missing | **translation** | link")
    return errors


def main() -> int:
    if not REGISTRY.is_file():
        print(f"Registry not found: {REGISTRY}")
        return 1
    paired = parse_paired_docs(REGISTRY.read_text(encoding="utf-8"))
    if not paired:
        print("No **paired** entries in MIGRATION_REGISTRY (operations section).")
        return 0

    errors: list[str] = []
    for name in paired:
        for lang in ("pl", "en"):
            errors.extend(check_file(resolve_doc_path(name, lang)))

    if errors:
        print("Documentation i18n check failed:\n")
        for err in errors:
            print(f"  {err}")
        return 1
    print(f"OK: {len(paired)} paired operation doc(s) have lang + translation metadata.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
