#!/usr/bin/env python3
"""Fix broken relative links in docs/en and docs/pl mirror trees."""
from __future__ import annotations

import os
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DOCS = REPO / "docs"
LINK_RE = re.compile(r"\]\(([^)]+)\)")

TEXT_REPLACEMENTS = [
    ("../../../operations/", "../../operations/"),
    ("../../../compliance/", "../../compliance/"),
    ("../../../onboarding/", "../../onboarding/"),
    ("../../../product/", "../../product/"),
    ("../../../reports/", "../../reports/"),
    ("../../../assets/", "../../assets/"),
    ("../../../admin/", "../../admin/"),
    ("../../../adr/", "../../adr/"),
    ("../../../quality/", "../../quality/"),
    ("../../../diagrams/", "../../diagrams/"),
    ("../../../../assets/", "../../assets/"),
    ("../operacje/", "../../operations/"),
    ("../operatives/", "../../operations/"),
    ("./operacje/", "../../operations/"),
    ("operacje/", "operations/"),
    ("operatives/", "operations/"),
    ("ARCHITEKTURA.md", "ARCHITECTURE.md"),
    ("../ARCHITEKTURA.md", "../../ARCHITECTURE.md"),
    ("../en/operations/LIVE_MAP.md", "./LIVE_MAP.md"),
    ("../en/operations/", "./"),
    ("generate- Third-party-notices", "generate-third-party-notices"),
    ("../ Operations/", "../../operations/"),
    ("./RELEASE_LEGAL_COMPLIANCE_PACKAGE.md", "../../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md"),
    ("./MAP_BASEMAP_LICENSING.md", "../../compliance/MAP_BASEMAP_LICENSING.md"),
    ("./COMPLIANCE_INDEX.md", "../../compliance/COMPLIANCE_INDEX.md"),
]


def exists_target(md_path: Path, target: str) -> bool:
    path_part = re.sub(r":\d+$", "", target.split("#", 1)[0].strip())
    if not path_part:
        return True
    if path_part.startswith(("http://", "https://", "mailto:", "#")):
        return True
    if path_part.startswith(("backend/", "admin/", "mobile/", "infrastructure/")):
        return (REPO / path_part).exists()
    return (md_path.parent / path_part).resolve().exists()


def resolve_link(md_path: Path, target: str) -> str:
    if exists_target(md_path, target):
        return target
    path_part, frag = (target.split("#", 1) + [""])[:2]
    frag_suffix = f"#{frag}" if frag else ""

    candidates: list[str] = []
    if path_part.startswith("./"):
        candidates.append("../../" + path_part[2:])
    if path_part.startswith("../"):
        candidates.append("../" + path_part)
        candidates.append("../../" + path_part[3:] if path_part.startswith("../") else path_part)
    if path_part.startswith("../../"):
        candidates.append("../" + path_part[6:])
        candidates.append("../../../" + path_part[6:])

    # pl/* subdirs -> docs root often needs ../../
    rel = md_path.relative_to(DOCS)
    if rel.parts[0] == "pl" and len(rel.parts) >= 2:
        base = path_part.lstrip("./")
        if base and not base.startswith(".."):
            candidates.append("../../" + base)
        if path_part.startswith("../") and not path_part.startswith("../../"):
            candidates.append("../../" + path_part[3:])

    # en/* subdirs -> repo paths need extra ..
    if rel.parts[0] == "en":
        if path_part.startswith("../") and not path_part.startswith("../../"):
            p = path_part[3:]
            if p.startswith(("backend/", "infrastructure/", "scripts/", "CHANGELOG", "CONTRIBUTING", ".env")):
                candidates.append("../../" + path_part[3:])
        if path_part.startswith("../../") and "infrastructure" in path_part:
            candidates.append("../../../" + path_part[6:])

    # en root: ./foo -> ../foo
    if rel.parts[0] == "en" and len(rel.parts) == 2:
        if path_part.startswith("./"):
            candidates.append("../" + path_part[2:])
        if path_part.startswith("../../"):
            candidates.append("../" + path_part[6:])

    seen: set[str] = set()
    for cand in candidates:
        if cand in seen or not cand:
            continue
        seen.add(cand)
        full = cand + frag_suffix
        if exists_target(md_path, full):
            return full
    return target


def fix_file(md: Path) -> bool:
    text = md.read_text(encoding="utf-8")
    for old, new in TEXT_REPLACEMENTS:
        text = text.replace(f"]({old}", f"]({new}")
        text = text.replace(old, new)

    def sub(m: re.Match) -> str:
        target = m.group(1).strip()
        fixed = resolve_link(md, target)
        return f"]({fixed})"

    new_text = LINK_RE.sub(sub, text)
    if new_text != md.read_text(encoding="utf-8"):
        md.write_text(new_text, encoding="utf-8")
        return True
    return False


def main() -> int:
    changed = 0
    for sub in ("en", "pl"):
        root = DOCS / sub
        if not root.is_dir():
            continue
        for md in sorted(root.rglob("*.md")):
            if fix_file(md):
                changed += 1
    # Second pass
    for sub in ("en", "pl"):
        root = DOCS / sub
        for md in sorted(root.rglob("*.md")):
            if fix_file(md):
                changed += 1
    print(f"Updated link targets in mirror trees ({changed} file passes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
