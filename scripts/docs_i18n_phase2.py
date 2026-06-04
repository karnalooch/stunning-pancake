#!/usr/bin/env python3
"""Phase 2: move PL canonical to docs/pl/; legacy paths become redirect stubs."""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DOCS = REPO / "docs"

OPS_LEGACY = DOCS / "operations"
RUN_LEGACY = DOCS / "runbooks"
OPS_PL = DOCS / "pl" / "operations"
RUN_PL = DOCS / "pl" / "runbooks"

ROOT_PL_FILES = [
    "README.md",
    "DOCUMENTATION_STANDARDS.md",
    "MAINTENANCE.md",
    "GETTING_STARTED.md",
    "INSTALLATION.md",
    "DEVELOPMENT.md",
    "CONFIGURATION.md",
    "DEPLOYMENT.md",
    "UPDATES.md",
    "MIGRATION.md",
    "TROUBLESHOOTING.md",
    "DISK_GUARD.md",
    "SCALE_TEST_300K.md",
    "EVENT_BURST_50K.md",
    "RAILWAY_CELERY_SIMULATION.md",
    "RBAC.md",
    "CONSTITUTION.md",
]

PRODUCT_ONBOARDING = [
    ("product", DOCS / "product"),
    ("onboarding", DOCS / "onboarding"),
]

CANONICAL_PATH_RE = re.compile(
    r"(\|\s*\*\*canonical_path\*\*\s*\|\s*)docs/(operations|runbooks)/([^|\s]+)",
    re.I,
)
H1_RE = re.compile(r"^#\s+(.+)$", re.M)

# One extra ../ when file moves from docs/X to docs/pl/X
LINK_UP_FIXES = [
    (re.compile(r"\]\(\.\./(?!\.)([^)]+)\)"), r"](../\1)"),
    (re.compile(r"\]\(\./([^)]+)\)"), r"](./\1)"),  # same-dir ops links unchanged
]


def fix_pl_links(text: str, moved_from_ops: bool) -> str:
    if moved_from_ops or "runbooks" in text:
        # ../FILE at docs/operations -> ../../FILE at docs/pl/operations
        def up_one(m: re.Match[str]) -> str:
            inner = m.group(1)
            if inner.startswith("../"):
                return f"](../../{inner[3:]})"
            if inner.startswith("./"):
                return m.group(0)
            if inner.startswith(("http", "#", "mailto")):
                return m.group(0)
            return f"](../../{inner})"

        text = re.sub(r"\]\(\.\./([^)]+)\)", up_one, text)
    return text


def update_canonical_path(text: str, new_canonical: str) -> str:
    return re.sub(
        r"\|\s*\*\*canonical_path\*\*\s*\|\s*[^\|]+\|",
        f"| **canonical_path** | {new_canonical} |",
        text,
        count=1,
    )


def legacy_stub(title: str, pl_canonical: str, en_path: str) -> str:
    pl_name = Path(pl_canonical).name
    en_name = Path(en_path).name
    pl_href = pl_canonical.removeprefix("docs/pl/")
    en_href = en_path.removeprefix("docs/en/")
    return f"""# {title}

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **lang** | pl |
| **translation** | [English](../en/{en_href}) |
| **canonical_path** | {pl_canonical} |
| **locale_redirect** | phase-2 |

> **Przekierowanie (faza 2):** Kanoniczna treść PL — [{pl_name}](../pl/{pl_href}).  
> English — [{en_name}](../en/{en_href}).

---

Edytuj dokument w `docs/pl/`. Ten plik zachowuje starą ścieżkę URL.
"""


def move_file(src: Path, dst: Path, *, pl_canonical: str, from_ops: bool, dry_run: bool) -> None:
    text = src.read_text(encoding="utf-8")
    text = update_canonical_path(text, pl_canonical)
    text = fix_pl_links(text, from_ops)
    if not dry_run:
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(text, encoding="utf-8")
    h1 = H1_RE.search(text)
    title = h1.group(1).strip() if h1 else dst.stem
    en_rel = f"docs/en/{dst.relative_to(DOCS / 'pl').as_posix()}"
    stub = legacy_stub(title, pl_canonical, en_rel)
    if not dry_run:
        src.write_text(stub, encoding="utf-8")


def move_tree(legacy_dir: Path, pl_dir: Path, prefix: str, dry_run: bool) -> int:
    n = 0
    if not legacy_dir.is_dir():
        return 0
    for src in sorted(legacy_dir.glob("*.md")):
        if src.name.startswith("."):
            continue
        body = src.read_text(encoding="utf-8")
        if "**locale_redirect**" in body:
            continue
        dst = pl_dir / src.name
        pl_canonical = f"docs/pl/{prefix}/{src.name}"
        move_file(src, dst, pl_canonical=pl_canonical, from_ops=True, dry_run=dry_run)
        n += 1
    return n


def move_root_guides(dry_run: bool) -> int:
    n = 0
    for name in ROOT_PL_FILES:
        src = DOCS / name
        if not src.is_file():
            continue
        body = src.read_text(encoding="utf-8")
        if "**locale_redirect**" in body:
            continue
        if not re.search(r"\|\s*\*\*lang\*\*\s*\|\s*pl\s*\|", body, re.I):
            continue
        dst = DOCS / "pl" / name
        pl_canonical = f"docs/pl/{name}"
        text = update_canonical_path(body, pl_canonical)
        # docs/FOO.md links ../bar -> ../../bar from docs/pl/
        text = re.sub(
            r"\]\(\.\./([^)]+)\)",
            lambda m: f"](../../{m.group(1)})" if not m.group(1).startswith(".") else m.group(0),
            text,
        )
        if not dry_run:
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_text(text, encoding="utf-8")
        h1 = H1_RE.search(text)
        title = h1.group(1).strip() if h1 else name
        en_rel = f"docs/en/{name}"
        stub = legacy_stub(title, pl_canonical, en_rel)
        if not dry_run:
            src.write_text(stub, encoding="utf-8")
        n += 1
    return n


def move_product_onboarding(dry_run: bool) -> int:
    n = 0
    for sub, legacy_dir in PRODUCT_ONBOARDING:
        pl_dir = DOCS / "pl" / sub
        if not legacy_dir.is_dir():
            continue
        for src in sorted(legacy_dir.glob("*.md")):
            body = src.read_text(encoding="utf-8")
            if "**locale_redirect**" in body:
                continue
            dst = pl_dir / src.name
            pl_canonical = f"docs/pl/{sub}/{src.name}"
            move_file(src, dst, pl_canonical=pl_canonical, from_ops=False, dry_run=dry_run)
            n += 1
    return n


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    ops = move_tree(OPS_LEGACY, OPS_PL, "operations", dry_run)
    run = move_tree(RUN_LEGACY, RUN_PL, "runbooks", dry_run)
    root = move_root_guides(dry_run)
    po = move_product_onboarding(dry_run)
    print(
        f"{'(dry-run) ' if dry_run else ''}moved: operations={ops}, runbooks={run}, "
        f"root={root}, product/onboarding={po}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
