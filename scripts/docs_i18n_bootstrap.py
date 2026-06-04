#!/usr/bin/env python3
"""Inject i18n metadata and create missing locale mirror files from i18n_manifest.json."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MANIFEST = REPO / "docs" / "locales" / "i18n_manifest.json"

META_TABLE_END = re.compile(r"^\s*---\s*$", re.M)
HAS_LANG = re.compile(r"\|\s*\*\*lang\*\*\s*\|", re.I)
H1_RE = re.compile(r"^#\s+(.+)$", re.M)


def load_manifest() -> list[dict]:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return data["entries"]


def rel_link(from_path: Path, to_repo_rel: str, label: str) -> str:
    target = REPO / to_repo_rel
    try:
        href = Path(
            os_path_relpath(from_path.parent, target)
        ).as_posix()
    except ValueError:
        href = to_repo_rel
    return f"[{label}]({href})"


def os_path_relpath(from_dir: Path, to_file: Path) -> str:
    import os

    return os.path.relpath(to_file, from_dir).replace("\\", "/")


def build_metadata_block(
    *,
    lang: str,
    translation_href: str,
    translation_label: str,
    canonical_path: str,
    status: str = "✅ Active",
    owner: str = "Documentation maintainer",
    reviewed: str = "2026-06-04",
    audience: str = "See canonical document",
) -> str:
    return (
        "| | |\n|--|--|\n"
        f"| **Status** | {status} |\n"
        f"| **Owner role** | {owner} |\n"
        f"| **Last reviewed** | {reviewed} |\n"
        f"| **Audience** | {audience} |\n"
        f"| **lang** | {lang} |\n"
        f"| **translation** | [{translation_label}]({translation_href}) |\n"
        f"| **canonical_path** | {canonical_path} |\n"
    )


def inject_metadata(path: Path, block: str, dry_run: bool) -> bool:
    if not path.is_file():
        return False
    text = path.read_text(encoding="utf-8")
    if HAS_LANG.search(text):
        return False
    m = H1_RE.search(text)
    if not m:
        return False
    h1_end = text.find("\n", m.start())
    if h1_end == -1:
        return False
    insert_at = h1_end + 1
    # Skip blank lines after H1
    while insert_at < len(text) and text[insert_at] in "\r\n":
        insert_at += 1
    new_text = text[:insert_at] + "\n" + block + "\n---\n\n" + text[insert_at:].lstrip("\n")
    if not dry_run:
        path.write_text(new_text, encoding="utf-8")
    return True


def mirror_stub_body(
    *,
    lang: str,
    title: str,
    peer_label: str,
    peer_href: str,
) -> str:
    if lang == "en":
        note = (
            f"> **Locale mirror:** Full English body is maintained in this file. "
            f"Polish canonical (legacy path): [{peer_label}]({peer_href}).\n"
        )
    else:
        note = (
            f"> **Odbicie locale:** Pełna treść po polsku w tym pliku. "
            f"Wersja angielska: [{peer_label}]({peer_href}).\n"
        )
    return f"# {title}\n\n{note}\n"


def ensure_mirror(
    entry: dict,
    *,
    lang: str,
    repo_rel: str,
    peer_rel: str,
    peer_label: str,
    dry_run: bool,
) -> bool:
    path = REPO / repo_rel
    if path.is_file():
        return False
    canonical = REPO / entry["canonical"]
    if not canonical.is_file():
        return False
    canonical_text = canonical.read_text(encoding="utf-8")
    h1 = H1_RE.search(canonical_text)
    title = h1.group(1).strip() if h1 else path.stem.replace("_", " ")
    peer_href = os_path_relpath(path.parent, REPO / peer_rel)
    block = build_metadata_block(
        lang=lang,
        translation_href=peer_href,
        translation_label=peer_label,
        canonical_path=repo_rel,
    )
    # Copy body from canonical when mirror language matches canonical language
    canon_lang = "pl" if entry.get("pl") == entry["canonical"] else "en"
    if lang == canon_lang:
        body = canonical_text
        if not HAS_LANG.search(body):
            m = H1_RE.search(body)
            if m:
                h1_end = body.find("\n", m.start()) + 1
                body = body[:h1_end] + "\n" + block + "\n---\n\n" + body[h1_end:].lstrip("\n")
        else:
            body = body  # already has meta; use as-is
    else:
        body = (
            f"# {title}\n\n{block}---\n\n"
            + mirror_stub_body(
                lang=lang,
                title=title,
                peer_label=peer_label,
                peer_href=peer_href,
            )
            + "\n<!-- i18n: translate body from "
            + entry["canonical"]
            + " -->\n"
        )
    if not dry_run:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")
    return True


def process_entry(entry: dict, dry_run: bool) -> tuple[int, int]:
    injected = 0
    created = 0
    if entry["mode"] == "n/a":
        return 0, 0

    if entry["mode"] == "en_only":
        en_path = REPO / entry["en"]
        peer = entry.get("pl")
        label = "Polski" if peer else "—"
        href = os_path_relpath(en_path.parent, REPO / peer) if peer else "#"
        block = build_metadata_block(
            lang="en",
            translation_href=href if peer and (REPO / peer).exists() else (os_path_relpath(en_path.parent, REPO / peer) if peer else "#"),
            translation_label=label,
            canonical_path=entry["en"],
        )
        if inject_metadata(en_path, block, dry_run):
            injected += 1
        if peer and not (REPO / peer).is_file():
            if ensure_mirror(
                entry,
                lang="pl",
                repo_rel=peer,
                peer_rel=entry["en"],
                peer_label="English",
                dry_run=dry_run,
            ):
                created += 1
        return injected, created

    pl_rel = entry.get("pl") or entry["canonical"]
    en_rel = entry.get("en")
    if not en_rel:
        return 0, 0

    pl_path = REPO / pl_rel
    en_path = REPO / en_rel

    if pl_path.is_file():
        block = build_metadata_block(
            lang="pl",
            translation_href=os_path_relpath(pl_path.parent, en_path),
            translation_label="English",
            canonical_path=pl_rel,
        )
        if inject_metadata(pl_path, block, dry_run):
            injected += 1

    if en_path.is_file():
        block = build_metadata_block(
            lang="en",
            translation_href=os_path_relpath(en_path.parent, pl_path),
            translation_label="Polski",
            canonical_path=en_rel,
        )
        if inject_metadata(en_path, block, dry_run):
            injected += 1

    if not en_path.is_file() and pl_path.is_file():
        if ensure_mirror(
            entry,
            lang="en",
            repo_rel=en_rel,
            peer_rel=pl_rel,
            peer_label="Polski",
            dry_run=dry_run,
        ):
            created += 1

    if not pl_path.is_file() and en_path.is_file() and pl_rel != en_rel:
        if ensure_mirror(
            entry,
            lang="pl",
            repo_rel=pl_rel,
            peer_rel=en_rel,
            peer_label="English",
            dry_run=dry_run,
        ):
            created += 1

    return injected, created


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    if not MANIFEST.is_file():
        print("Run scripts/docs_i18n_manifest.py first.")
        return 1
    entries = load_manifest()
    inj = crt = 0
    for entry in entries:
        i, c = process_entry(entry, dry_run=dry_run)
        inj += i
        crt += c
    print(f"{'(dry-run) ' if dry_run else ''}metadata injected: {inj}, mirrors created: {crt}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
