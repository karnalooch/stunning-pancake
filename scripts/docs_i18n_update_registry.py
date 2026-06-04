#!/usr/bin/env python3
"""Regenerate docs/locales/MIGRATION_REGISTRY.md from i18n_manifest.json."""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MANIFEST = REPO / "docs" / "locales" / "i18n_manifest.json"
OUT = REPO / "docs" / "locales" / "MIGRATION_REGISTRY.md"
STUB = re.compile(r"i18n:\s*translate body from", re.I)


def status_for(entry: dict) -> str:
    mode = entry["mode"]
    if mode == "n/a":
        return "n/a"
    paths = []
    if mode == "paired":
        paths = [entry.get("pl"), entry.get("en")]
    elif mode == "en_only":
        paths = [entry.get("en"), entry.get("pl")]
    for p in paths:
        if not p:
            continue
        f = REPO / p
        if f.is_file() and STUB.search(f.read_text(encoding="utf-8")):
            return "translation-debt"
    if mode == "en_only" and entry.get("pl"):
        pl = REPO / entry["pl"]
        if pl.is_file() and len(pl.read_text(encoding="utf-8")) < 900:
            return "summary"
        return "en-only + pl summary"
    if mode == "paired":
        return "paired"
    return mode


def row(entry: dict) -> str:
    name = Path(entry["canonical"]).name
    st = status_for(entry)
    pl = entry.get("pl", "—")
    en = entry.get("en", entry.get("canonical", "—"))
    note = ""
    if entry["mode"] == "en_only" and entry.get("pl"):
        note = "PL: short summary in `docs/pl/adr/`"
    if "adr" in entry.get("canonical", ""):
        note = "ADR EN canonical; PL summary mirror"
    return f"| {name} | **{st}** | `{pl}` | `{en}` | {note} |"


def section(title: str, entries: list[dict]) -> str:
    if not entries:
        return ""
    lines = [
        f"## {title}",
        "",
        "| Document | Status | PL path | EN path | Notes |",
        "|----------|--------|---------|---------|-------|",
    ]
    lines.extend(row(e) for e in sorted(entries, key=lambda x: x["canonical"]))
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    entries = data["entries"]
    today = date.today().isoformat()

    ops = [e for e in entries if "operations/" in e.get("canonical", "")]
    runbooks = [e for e in entries if "runbooks/" in e.get("canonical", "")]
    adr = [e for e in entries if "/adr/" in e.get("canonical", "")]
    admin = [e for e in entries if "/admin/" in e.get("canonical", "")]
    quality = [e for e in entries if "/quality/" in e.get("canonical", "")]
    compliance = [e for e in entries if "/compliance/" in e.get("canonical", "")]
    root = [
        e
        for e in entries
        if e.get("canonical", "").count("/") == 1
        and e["canonical"].startswith("docs/")
        and Path(e["canonical"]).suffix == ".md"
    ]

    paired = sum(1 for e in entries if e["mode"] == "paired" and status_for(e) == "paired")
    debt = sum(1 for e in entries if status_for(e) == "translation-debt")

    body = f"""# Documentation i18n migration registry

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | {today} |
| **Audience** | Authors updating docs |

**Auto-generated:** `python scripts/docs_i18n_update_registry.py` from `i18n_manifest.json`.

**Snapshot:** {paired} paired locales ready · {debt} translation-debt (stub marker) · manifest v{data.get('version', 1)}

**Legend:** `paired` · `en-only` · `pl-only` · `translation-debt` · `summary` · `n/a`

---

{section("Operations (`docs/operations/` ↔ `docs/en/operations/`)", ops)}
{section("Runbooks (`docs/runbooks/` ↔ `docs/en/runbooks/`)", runbooks)}
{section("Root guides (`docs/` ↔ `docs/en/`)", root)}
{section("ADR (`docs/adr/` + `docs/pl/adr/` summaries)", adr)}
{section("Admin (`docs/admin/` ↔ `docs/pl/admin/`)", admin)}
{section("Quality (`docs/quality/` ↔ `docs/pl/quality/`)", quality)}
{section("Compliance", compliance)}

---

## How to mark progress

1. Add EN file under `docs/en/...` (mirror path) or PL under `docs/pl/...`.
2. Add metadata `lang` + `translation` to both files.
3. Run `python scripts/docs_i18n_translate_mirrors.py --workers 4`.
4. Run `python scripts/docs_i18n_fix_links.py` then CI scripts.
5. Re-run this script to refresh the table.
"""
    OUT.write_text(body, encoding="utf-8")
    print(f"Wrote {OUT.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
