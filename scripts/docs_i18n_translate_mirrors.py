#!/usr/bin/env python3
"""
Fill EN/PL mirror docs from canonical sources (replaces i18n stub markers).
Preserves fenced code blocks, inline code, env var names, and URLs.

Usage:
  python scripts/docs_i18n_translate_mirrors.py [--workers 4] [--sleep 0]
  python scripts/docs_i18n_translate_mirrors.py docs/en/onboarding
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MANIFEST = REPO / "docs" / "locales" / "i18n_manifest.json"
STUB_RE = re.compile(r"<!--\s*i18n:\s*translate body from\s+([^>]+)\s*-->", re.I)
H1_RE = re.compile(r"^#\s+(.+)$", re.M)
HAS_LANG = re.compile(r"\|\s*\*\*lang\*\*\s*\|\s*(en|pl)\s*\|", re.I)
FENCE_RE = re.compile(r"(```[\s\S]*?```)", re.M)
ADR_SUMMARY_STOP = re.compile(
    r"^##\s+(Implementation|Alternatives|Appendix|Detailed\s|Plan\s|Rollout|"
    r"Migration\s|Testing|Observability|References|Appendix|Work\s+breakdown)\b",
    re.I | re.M,
)
POLISH_HINT = re.compile(
    r"\b(Decyzja|Kontekst|Uzasadnienie|Konsekwencje|Zaakceptowany|Wybieramy)\b",
    re.I,
)

CHUNK_MAX = 4500
MIN_DONE_CHARS = 800

_thread_local = threading.local()


def load_manifest() -> list[dict]:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))["entries"]


def split_fences(text: str) -> list[tuple[str, bool]]:
    parts: list[tuple[str, bool]] = []
    last = 0
    for m in FENCE_RE.finditer(text):
        if m.start() > last:
            parts.append((text[last : m.start()], False))
        parts.append((m.group(1), True))
        last = m.end()
    if last < len(text):
        parts.append((text[last:], False))
    return parts


def _translator(target: str):
    cache = getattr(_thread_local, "translators", None)
    if cache is None:
        cache = {}
        _thread_local.translators = cache
    if target not in cache:
        from deep_translator import GoogleTranslator

        cache[target] = GoogleTranslator(source="auto", target=target)
    return cache[target]


def translate_chunks(translator, text: str, sleep_s: float) -> str:
    if not text.strip():
        return text
    out: list[str] = []
    buf = text
    while buf:
        chunk = buf[:CHUNK_MAX]
        if len(buf) > CHUNK_MAX:
            cut = chunk.rfind("\n\n")
            if cut < CHUNK_MAX // 2:
                cut = chunk.rfind("\n")
            if cut < CHUNK_MAX // 2:
                cut = CHUNK_MAX
            chunk = buf[:cut]
            buf = buf[cut:]
        else:
            buf = ""
        try:
            out.append(translator.translate(chunk))
        except Exception:
            out.append(chunk)
        if sleep_s > 0:
            time.sleep(sleep_s)
    return "".join(out)


def translate_prose(translator, text: str, sleep_s: float) -> str:
    segments = split_fences(text)
    result: list[str] = []
    for segment, is_code in segments:
        if is_code:
            result.append(segment)
        else:
            result.append(translate_chunks(translator, segment, sleep_s))
    return "".join(result)


def extract_metadata_and_body(text: str) -> tuple[str, str]:
    if not HAS_LANG.search(text):
        return "", text
    h1 = H1_RE.search(text)
    if not h1:
        return "", text
    start = h1.start()
    rest = text[start:]
    sep = rest.find("\n---\n")
    if sep == -1:
        return "", text
    header_end = start + sep + len("\n---\n")
    header = text[:header_end]
    body = text[header_end:].lstrip("\n")
    body = STUB_RE.sub("", body)
    body = re.sub(
        r"^> \*\*Locale mirror:\*\*.*?\n\n",
        "",
        body,
        flags=re.M | re.S,
    )
    body = re.sub(
        r"^> \*\*Odbicie locale:\*\*.*?\n\n",
        "",
        body,
        flags=re.M | re.S,
    )
    lines = body.splitlines()
    while lines and lines[0].startswith("# "):
        lines = lines[1:]
        while lines and not lines[0].strip():
            lines = lines[1:]
    return header, "\n".join(lines)


def build_en_header(mirror_rel: str, canonical_rel: str, title: str) -> str:
    link = os.path.relpath(REPO / canonical_rel, REPO / mirror_rel).replace("\\", "/")
    return (
        f"# {title}\n\n"
        "| | |\n|--|--|\n"
        "| **Status** | ✅ Active |\n"
        "| **Owner role** | Documentation maintainer |\n"
        f"| **Last reviewed** | 2026-06-04 |\n"
        "| **Audience** | See canonical document |\n"
        "| **lang** | en |\n"
        f"| **translation** | [Polski]({link}) |\n"
        f"| **canonical_path** | {mirror_rel} |\n"
        "---\n\n"
    )


def build_pl_header(mirror_rel: str, canonical_rel: str, title: str) -> str:
    link = os.path.relpath(REPO / canonical_rel, REPO / mirror_rel).replace("\\", "/")
    return (
        f"# {title}\n\n"
        "| | |\n|--|--|\n"
        "| **Status** | ✅ Active |\n"
        "| **Owner role** | Documentation maintainer |\n"
        f"| **Last reviewed** | 2026-06-04 |\n"
        "| **Audience** | Zobacz dokument kanoniczny |\n"
        "| **lang** | pl |\n"
        f"| **translation** | [English]({link}) |\n"
        f"| **canonical_path** | {mirror_rel} |\n"
        "---\n\n"
    )


def is_mirror_done(text: str) -> bool:
    return not STUB_RE.search(text) and len(text) > MIN_DONE_CHARS


def extract_adr_summary_body(body: str, max_chars: int = 3800) -> str:
    m = re.search(r"^##\s+(Status|Kontekst|Context)\b", body, re.M | re.I)
    if not m:
        return body[:max_chars]
    chunk = body[m.start() :]
    stop = ADR_SUMMARY_STOP.search(chunk, pos=80)
    if stop:
        chunk = chunk[: stop.start()]
    return chunk[:max_chars].rstrip() + "\n"


def process_adr_summary_mirror(
    mirror_rel: str, canonical_rel: str, sleep_s: float
) -> bool:
    mirror = REPO / mirror_rel
    canonical = REPO / canonical_rel
    if not mirror.is_file() or not canonical.is_file():
        return False
    text = mirror.read_text(encoding="utf-8")
    if is_mirror_done(text):
        return False

    canon_text = canonical.read_text(encoding="utf-8")
    _, canon_body = extract_metadata_and_body(canon_text)
    summary = extract_adr_summary_body(canon_body)

    h1 = H1_RE.search(canon_text)
    title = h1.group(1).strip() if h1 else "ADR"
    adr_link = os.path.relpath(canonical, mirror.parent).replace("\\", "/")

    if POLISH_HINT.search(summary):
        body_pl = summary
    else:
        tr = _translator("pl")
        body_pl = translate_prose(tr, summary, sleep_s)

    header = build_pl_header(mirror_rel, canonical_rel, title)
    footer = (
        "\n\n---\n\n"
        "## Pełna wersja (kanoniczna)\n\n"
        f"Pełny tekst ADR (język źródłowy dokumentu): "
        f"**[{canonical.name}]({adr_link})**.\n\n"
        "> Skrót PL — nie zastępuje pełnego ADR przy review architektury.\n"
    )
    mirror.write_text(header + body_pl + footer, encoding="utf-8")
    return True


def process_mirror(
    mirror_rel: str, canonical_rel: str, target_lang: str, sleep_s: float
) -> bool:
    if mirror_rel.replace("\\", "/").startswith("docs/pl/adr/"):
        return process_adr_summary_mirror(mirror_rel, canonical_rel, sleep_s)

    mirror = REPO / mirror_rel
    canonical = REPO / canonical_rel
    if not mirror.is_file() or not canonical.is_file():
        return False
    text = mirror.read_text(encoding="utf-8")
    if is_mirror_done(text):
        return False

    canon_text = canonical.read_text(encoding="utf-8")
    _, canon_body = extract_metadata_and_body(canon_text)
    h1 = H1_RE.search(canon_text)
    title = h1.group(1).strip() if h1 else "Document"

    if target_lang == "en":
        tr = _translator("en")
        title_out = translate_chunks(tr, title, sleep_s)
        header = build_en_header(mirror_rel, canonical_rel, title_out)
        body_out = translate_prose(tr, canon_body, sleep_s)
    else:
        tr = _translator("pl")
        title_out = translate_chunks(tr, title, sleep_s)
        header = build_pl_header(mirror_rel, canonical_rel, title_out)
        body_out = translate_prose(tr, canon_body, sleep_s)

    mirror.write_text(header + body_out + "\n", encoding="utf-8")
    return True


def find_stub_mirrors() -> list[tuple[str, str, str]]:
    items: list[tuple[str, str, str]] = []
    for path in REPO.glob("docs/**/*.md"):
        text = path.read_text(encoding="utf-8")
        m = STUB_RE.search(text)
        if not m:
            continue
        canonical_rel = m.group(1).strip()
        rel = path.relative_to(REPO).as_posix()
        lang_m = HAS_LANG.search(text)
        target = lang_m.group(1).lower() if lang_m else "en"
        items.append((rel, canonical_rel, target))
    return items


def _work_item(args: tuple) -> tuple[str, bool, str | None]:
    mirror_rel, canonical_rel, target_lang, sleep_s = args
    try:
        ok = process_mirror(mirror_rel, canonical_rel, target_lang, sleep_s)
        return mirror_rel, ok, None
    except Exception as exc:
        return mirror_rel, False, str(exc)


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "filters",
        nargs="*",
        help="Optional path substrings (e.g. docs/en docs/pl/quality)",
    )
    p.add_argument("--dry-run", action="store_true")
    p.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Parallel file workers (default 4)",
    )
    p.add_argument(
        "--sleep",
        type=float,
        default=0.0,
        help="Seconds between translation chunks (default 0)",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    try:
        from deep_translator import GoogleTranslator  # noqa: F401
    except ImportError:
        raise SystemExit("Install: pip install deep-translator") from None

    args = parse_args(argv or sys.argv[1:])
    stubs = find_stub_mirrors()
    if args.filters:
        stubs = [s for s in stubs if any(f in s[0] for f in args.filters)]

    print(f"Mirrors to translate: {len(stubs)}")
    if args.dry_run:
        for s in stubs[:30]:
            print(f"  {s[0]} <- {s[1]} ({s[2]})")
        return 0

    work = [(m, c, t, args.sleep) for m, c, t in stubs]
    done = 0
    failed = 0

    if args.workers <= 1:
        for item in work:
            rel, ok, err = _work_item(item)
            if err:
                print(f"FAIL {rel}: {err}")
                failed += 1
            elif ok:
                done += 1
                print(f"OK {rel}")
            else:
                print(f"SKIP {rel}")
    else:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(_work_item, w): w[0] for w in work}
            for fut in as_completed(futures):
                rel, ok, err = fut.result()
                if err:
                    print(f"FAIL {rel}: {err}")
                    failed += 1
                elif ok:
                    done += 1
                    print(f"OK {rel}")
                else:
                    print(f"SKIP {rel}")

    print(f"Translated {done}/{len(stubs)} (failed {failed})")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
