# Documentation localization standard (enterprise)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Doc authors, reviewers |
| **Polish version** | [STANDARD.pl.md](./STANDARD.pl.md) |

---

## Goal

Every **Active** operational and product document has a maintained **English** and **Polish** version with the **same relative path** under `docs/en/` and `docs/pl/`, without duplicating secrets or env values.

---

## How enterprises usually do it

| Pattern | When | 4VELO choice |
|---------|------|--------------|
| **Parallel locale trees** (`docs/en/`, `docs/pl/`) | Runbooks, onboarding, compliance summaries | ✅ Primary for paired docs |
| **English canonical only** | ADRs, OpenAPI, architecture contracts | ✅ `docs/adr/`, `API.md` stay EN |
| **Legacy path + banner** | Avoid breaking hundreds of links during migration | ✅ `docs/operations/*.md` stays PL until moved |
| **Translation frontmatter** | Audits and CI | ✅ Required on paired docs |
| **Separate TMS (Phrase, Lokalise)** | Large customer-facing portals | Optional later; repo-first for engineering docs |
| **Machine translation in CI** | High volume marketing | ❌ Not for runbooks — human or author bilingual edit |

References in industry: GitLab (English docs + i18n contributions), Kubernetes (English canonical + localized sites), EU regulated ops (local-language runbooks + English architecture).

---

## Required metadata (paired documents)

Add to the metadata table at the top of **both** files:

```markdown
| **lang** | en \| pl |
| **translation** | [Polski](../pl/operations/LIVE_MAP.md) |
| **translation_status** | reviewed \| machine-translated |
| **translation_reviewed** | 2026-06-04 (when reviewed) |
| **canonical_path** | docs/en/operations/LIVE_MAP.md |
```

- **lang** — language of the file body.
- **translation** — relative link to the other language (same topic).
- **canonical_path** — stable path used in the [MIGRATION_REGISTRY](./MIGRATION_REGISTRY.md) (for CI).

Legacy Polish-only paths include the same row; **translation** points to `docs/en/...`.

---

## Path rules

| Content type | Canonical language | EN path | PL path |
|--------------|-------------------|---------|---------|
| Operations runbook | PL (operator audience) | `docs/en/operations/<NAME>.md` | `docs/pl/operations/<NAME>.md` (legacy `docs/operations/<NAME>.md` = redirect stub) |
| ADR | EN | `docs/adr/<NNN>-*.md` | Optional `docs/pl/adr/<NNN>-summary.md` (short, not full duplicate) |
| API / architecture spec | EN | `docs/API.md`, `docs/ARCHITECTURE.md` | `docs/pl/API.md` when migrated |
| Admin smoke / checklists | EN | `docs/admin/*.md` | `docs/pl/admin/*.md` when migrated |
| Compliance (legal EN pack) | EN | `docs/compliance/RELEASE_*.md` | PL summary in `docs/pl/compliance/` if needed |
| Snapshots `reports/*_DATE.md` | — | No pairing | No edits |
| `archive/*` | — | Deprecated only | Redirect banner |

**SSOT for env names** stays in one language table per topic — the other language **links**, does not copy full variable tables (see [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md)).

---

## Author workflow

1. Change the **canonical** file for that topic (see registry).
2. Update the **paired** file in the same PR when the change is user-facing (ops steps, UI labels, env toggles).
3. Bump **Last reviewed** on both.
4. Register new docs in [MIGRATION_REGISTRY.md](./MIGRATION_REGISTRY.md) before merge.
5. Run `python scripts/check_docs_links.py` and `python scripts/check_docs_i18n.py`.

If only one language is updated, set registry status to `translation-debt` until the pair is synced.

---

## Layer diagrams (Mermaid)

For **client → services → databases** flows (GPS, sessions, ingest):

| Element | Rule |
|---------|------|
| Heading | `## Layers (client to server)` (PL: `Warstwy (od klienta do serwera)`) |
| Fence | Blank line before/after a ` ```mermaid ` block — never glue heading and fence on one line |
| Syntax | `flowchart LR` or `flowchart TB`; code identifiers in backticks |
| Reference | [pl/DATA_RESILIENCE.md](../pl/DATA_RESILIENCE.md) (canonical PL body + diagram) |
| C4 | [diagrams/architecture_c4.md](../diagrams/architecture_c4.md) — complementary, not a replacement |

GitHub renders Mermaid in Markdown preview; link checks do not validate Mermaid syntax.

---

## Migration phases

| Phase | Action |
|-------|--------|
| **0** | Policy + registry + CI (this folder) |
| **1** | Operations runbooks: EN mirror under `docs/en/operations/`; PL remains at legacy path with banner |
| **2** | Move PL to `docs/pl/operations/`; legacy path becomes stub redirect |
| **3** | Root guides (`GETTING_STARTED`, `INSTALLATION`, …) |
| **4** | Optional PL summaries for ADRs |

---

## Related

- [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md) — section templates, security
- [MIGRATION_REGISTRY.md](./MIGRATION_REGISTRY.md) — file-level status
- [README.md](./README.md) — bilingual hub
