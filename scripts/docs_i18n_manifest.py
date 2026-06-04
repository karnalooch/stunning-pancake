#!/usr/bin/env python3
"""Generate docs/locales/i18n_manifest.json from repo layout and i18n rules."""
from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DOCS = REPO / "docs"
OUT = DOCS / "locales" / "i18n_manifest.json"

SKIP_DIRS = {"en", "pl", "locales", "archive"}
SNAPSHOT_NAME_RE = re.compile(r"_20\d{2}-\d{2}-\d{2}\.md$", re.I)

EN_ONLY_PREFIXES = (
    "docs/adr/",
    "docs/quality/",
)
EN_ONLY_FILES = {
    "docs/API.md",
    "docs/ARCHITECTURE.md",
    "docs/SIMULATOR_ARCHITECTURE.md",
    "docs/DEPARTMENT_ARCHITECTURE.md",
    "docs/DATA_RESILIENCE.md",
    "docs/diagrams/architecture_c4.md",
    "docs/compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md",
    "docs/compliance/MAP_BASEMAP_LICENSING.md",
    "docs/admin/P0_SMOKE_CHECKLIST.md",
    "docs/admin/UI_AUDIT_2026-06-02.md",
    "docs/reports/RELIABILITY_AUDIT_PLAYBOOK.md",
}

PL_CANONICAL_PREFIXES = (
    "docs/pl/operations/",
    "docs/pl/runbooks/",
    "docs/pl/product/",
    "docs/pl/onboarding/",
)
LEGACY_REDIRECT_PREFIXES = (
    "docs/operations/",
    "docs/runbooks/",
)
LEGACY_REDIRECT_FILES = {
    "docs/README.md",
    "docs/DOCUMENTATION_STANDARDS.md",
    "docs/MAINTENANCE.md",
    "docs/GETTING_STARTED.md",
    "docs/INSTALLATION.md",
    "docs/DEVELOPMENT.md",
    "docs/CONFIGURATION.md",
    "docs/DEPLOYMENT.md",
    "docs/UPDATES.md",
    "docs/MIGRATION.md",
    "docs/TROUBLESHOOTING.md",
    "docs/DISK_GUARD.md",
    "docs/SCALE_TEST_300K.md",
    "docs/EVENT_BURST_50K.md",
    "docs/RAILWAY_CELERY_SIMULATION.md",
    "docs/RBAC.md",
    "docs/CONSTITUTION.md",
}
PL_MIRROR_FILES = {
    "docs/pl/README.md",
    "docs/pl/DOCUMENTATION_STANDARDS.md",
    "docs/pl/MAINTENANCE.md",
    "docs/pl/GETTING_STARTED.md",
    "docs/pl/INSTALLATION.md",
    "docs/pl/DEVELOPMENT.md",
    "docs/pl/CONFIGURATION.md",
    "docs/pl/DEPLOYMENT.md",
    "docs/pl/UPDATES.md",
    "docs/pl/MIGRATION.md",
    "docs/pl/TROUBLESHOOTING.md",
    "docs/pl/DISK_GUARD.md",
    "docs/pl/SCALE_TEST_300K.md",
    "docs/pl/EVENT_BURST_50K.md",
    "docs/pl/RAILWAY_CELERY_SIMULATION.md",
    "docs/pl/RBAC.md",
    "docs/pl/CONSTITUTION.md",
}
LEGACY_PL_PAIRED_FILES = {
    "docs/compliance/RCP.md",
    "docs/compliance/README.md",
    "docs/compliance/COMPLIANCE_INDEX.md",
    "docs/assets/README.md",
    "docs/assets/live/README.md",
    "docs/reports/README.md",
}
LOCALE_REDIRECT_RE = re.compile(r"\*\*locale_redirect\*\*", re.I)

# EN canonical; PL mirror under docs/pl/
EN_CANONICAL_ADMIN = {
    "docs/admin/README.md",
    "docs/admin/ADMIN_INDEX.md",
    "docs/admin/P1_ROADMAP.md",
    "docs/admin/P2_ROADMAP.md",
    "docs/admin/ROADMAP_V3.md",
}

N_A_GLOBS = (
    "docs/archive/",
    "docs/admin/UI_AUDIT_",
)


def rel(p: Path) -> str:
    return p.relative_to(REPO).as_posix()


def is_snapshot(path: Path) -> bool:
    if SNAPSHOT_NAME_RE.search(path.name):
        return True
    if "archive" in path.parts:
        return True
    if path.name.startswith("UI_AUDIT_") and path.parent.name == "admin":
        return True
    return False


def is_legacy_redirect(path: Path) -> bool:
    r = rel(path)
    if not path.is_file():
        return False
    if not LOCALE_REDIRECT_RE.search(path.read_text(encoding="utf-8")):
        return False
    for prefix in LEGACY_REDIRECT_PREFIXES:
        if r.startswith(prefix):
            return True
    return r in LEGACY_REDIRECT_FILES


def classify(path: Path) -> dict:
    r = rel(path)
    if is_snapshot(path):
        return {"mode": "n/a", "canonical": r}

    if is_legacy_redirect(path):
        rel_under = path.relative_to(DOCS)
        if "operations" in rel_under.parts:
            name = path.name
            pl = f"docs/pl/operations/{name}"
            en = f"docs/en/operations/{name}"
        elif "runbooks" in rel_under.parts:
            name = path.name
            pl = f"docs/pl/runbooks/{name}"
            en = f"docs/en/runbooks/{name}"
        else:
            pl = f"docs/pl/{path.name}"
            en = f"docs/en/{path.name}"
        return {"mode": "legacy_redirect", "canonical": pl, "pl": pl, "en": en, "legacy": r}

    for prefix in EN_ONLY_PREFIXES:
        if r.startswith(prefix):
            return {
                "mode": "en_only",
                "canonical": r,
                "en": r,
                "pl": f"docs/pl/{path.relative_to(DOCS).as_posix()}",
            }

    if r in EN_ONLY_FILES:
        rel_under = path.relative_to(DOCS)
        return {
            "mode": "en_only",
            "canonical": r,
            "en": r,
            "pl": f"docs/pl/{rel_under.as_posix()}",
        }

    if r in EN_CANONICAL_ADMIN:
        rel_under = path.relative_to(DOCS)
        return {
            "mode": "paired",
            "canonical": r,
            "en": r,
            "pl": f"docs/pl/{rel_under.as_posix()}",
        }

    for prefix in PL_CANONICAL_PREFIXES:
        if r.startswith(prefix):
            rel_under = path.relative_to(DOCS / "pl")
            return {
                "mode": "paired",
                "canonical": r,
                "pl": r,
                "en": f"docs/en/{rel_under.as_posix()}",
            }

    if r in PL_MIRROR_FILES:
        rel_under = path.relative_to(DOCS / "pl")
        return {
            "mode": "paired",
            "canonical": r,
            "pl": r,
            "en": f"docs/en/{rel_under.as_posix()}",
        }

    if r in LEGACY_PL_PAIRED_FILES:
        rel_under = path.relative_to(DOCS)
        return {
            "mode": "paired",
            "canonical": r,
            "pl": r,
            "en": f"docs/en/{rel_under.as_posix()}",
        }

    # Default active docs: paired with PL legacy canonical
    rel_under = path.relative_to(DOCS)
    return {
        "mode": "paired",
        "canonical": r,
        "pl": r,
        "en": f"docs/en/{rel_under.as_posix()}",
    }


def collect() -> list[dict]:
    entries: list[dict] = []
    seen_canonical: set[str] = set()

    for md in sorted((DOCS / "pl").rglob("*.md")):
        entry = classify(md)
        c = entry.get("canonical", "")
        if c and c not in seen_canonical:
            entries.append(entry)
            seen_canonical.add(c)

    for md in sorted(DOCS.rglob("*.md")):
        if any(part in SKIP_DIRS for part in md.parts):
            continue
        entry = classify(md)
        c = entry.get("canonical", "")
        if entry["mode"] == "legacy_redirect":
            entries.append(entry)
            continue
        if c in seen_canonical:
            continue
        entries.append(entry)
        if c:
            seen_canonical.add(c)
    return entries


def main() -> None:
    entries = collect()
    payload = {
        "version": 1,
        "generated_by": "scripts/docs_i18n_manifest.py",
        "entries": entries,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    modes: dict[str, int] = {}
    for e in entries:
        modes[e["mode"]] = modes.get(e["mode"], 0) + 1
    print(f"Wrote {OUT} ({len(entries)} entries): {modes}")


if __name__ == "__main__":
    main()
