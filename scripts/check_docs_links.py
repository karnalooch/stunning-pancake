#!/usr/bin/env python3
"""Verify relative markdown links in docs/ and root README resolve to existing files."""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DOCS = REPO / "docs"
LINK_RE = re.compile(r"\]\(([^)]+)\)")
SCAN_ROOTS = (DOCS, REPO / "README.md", REPO / "CHANGELOG.md", REPO / "CONTRIBUTING.md")


def check_file(md_path: Path) -> list[str]:
    errors: list[str] = []
    try:
        text = md_path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"{md_path}: cannot read ({exc})"]
    for match in LINK_RE.finditer(text):
        target = match.group(1).strip()
        if not target or target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        # Templates use placeholders such as `[FAQ_LINK]`; they are not filesystem links.
        if "[" in target or "]" in target:
            continue
        path_part = target.split("#", 1)[0].strip()
        if not path_part or path_part.startswith("<"):
            continue
        if path_part.startswith("file://"):
            continue
        # GitHub-style path:line — verify file only
        path_part = re.sub(r":\d+(?:-\d+)?$", "", path_part)
        if path_part.startswith(("mobile/", "backend/", "admin/", "infrastructure/")):
            resolved = (REPO / path_part).resolve()
        else:
            resolved = (md_path.parent / path_part).resolve()
        if not resolved.exists():
            rel = md_path.relative_to(REPO)
            errors.append(f"{rel}: broken link -> {target}")
    return errors


def main() -> int:
    files: list[Path] = []
    if DOCS.is_dir():
        for md in DOCS.rglob("*.md"):
            # Historical snapshots describe files that intentionally no longer exist.
            if "archive" in md.parts:
                continue
            files.append(md)
    for root in SCAN_ROOTS:
        if isinstance(root, Path) and root.is_file() and root.suffix == ".md":
            files.append(root)
    errors: list[str] = []
    for md in sorted(set(files)):
        errors.extend(check_file(md))
    if errors:
        print("Broken documentation links:\n")
        for err in errors:
            print(f"  {err}")
        return 1
    print(f"OK — checked {len(set(files))} markdown files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
