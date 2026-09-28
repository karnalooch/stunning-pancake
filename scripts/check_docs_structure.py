#!/usr/bin/env python3
"""Structural guardrails for the 4VELO documentation tree."""
from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DOCS = REPO / "docs"
ADR_DIR = DOCS / "adr"

ADR_RE = re.compile(r"^(\d{3})-.+\.md$")

TOP_LEVEL_MD_ALLOWLIST = {
    "API.md",
    "ARCHITECTURE.md",
    "CONFIGURATION.md",
    "CONSTITUTION.md",
    "DATA_RESILIENCE.md",
    "DEPARTMENT_ARCHITECTURE.md",
    "DEPLOYMENT.md",
    "DEVELOPMENT.md",
    "DISK_GUARD.md",
    "DOCUMENTATION_LIFECYCLE.md",
    "DOCUMENTATION_STANDARDS.md",
    "EVENT_BURST_50K.md",
    "GETTING_STARTED.md",
    "INSTALLATION.md",
    "MAINTENANCE.md",
    "MIGRATION.md",
    "P3_PILOT_DATA_SAFETY_AUDIT_2026-09-16.md",
    "PARTIAL_TAKEOVER_PILOT_PLAN.md",
    "PROJECT_TAKEOVER.md",
    "RAILWAY_CELERY_SIMULATION.md",
    "RBAC.md",
    "README.md",
    "SCALE_TEST_300K.md",
    "SIMULATOR_ARCHITECTURE.md",
    "TAKEOVER_CLEANUP_PLAN.md",
    "TAKEOVER_PLAN_CURRENT.md",
    "TAKEOVER_WORK_QUEUE.md",
    "TROUBLESHOOTING.md",
    "UPDATES.md",
}

REQUIRED_SECTION_DIRS = {
    "adr", "archive", "audits", "ci", "compliance", "design", "en", "locales",
    "operations", "pl", "quality", "reports", "runbooks", "security",
}


def duplicate_adr_ids(adr_dir: Path) -> dict[str, list[str]]:
    by_id: dict[str, list[str]] = defaultdict(list)
    if not adr_dir.is_dir():
        return {"missing": [str(adr_dir)]}
    for path in sorted(adr_dir.glob("*.md")):
        if path.name == "README.md":
            continue
        match = ADR_RE.match(path.name)
        if not match:
            continue
        by_id[match.group(1)].append(path.name)
    return {key: values for key, values in by_id.items() if len(values) > 1}


def unexpected_top_level_markdown(docs_dir: Path) -> list[str]:
    return sorted(
        path.name
        for path in docs_dir.glob("*.md")
        if path.name not in TOP_LEVEL_MD_ALLOWLIST
    )


def missing_required_sections(docs_dir: Path) -> list[str]:
    return sorted(name for name in REQUIRED_SECTION_DIRS if not (docs_dir / name).is_dir())


def main() -> int:
    errors: list[str] = []

    duplicates = duplicate_adr_ids(ADR_DIR)
    if duplicates:
        for adr_id, names in sorted(duplicates.items()):
            errors.append(f"duplicate ADR id {adr_id}: {', '.join(names)}")

    for name in unexpected_top_level_markdown(DOCS):
        errors.append(f"unexpected top-level docs markdown: docs/{name}")

    for name in missing_required_sections(DOCS):
        errors.append(f"missing required docs section: docs/{name}/")

    if not (ADR_DIR / "README.md").is_file():
        errors.append("missing ADR index: docs/adr/README.md")

    if errors:
        print("Documentation structure check failed:\n")
        for error in errors:
            print(f"  {error}")
        return 1

    print("OK — docs structure, top-level allowlist and ADR numbering are consistent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
