# Documentation locales — 4VELO

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Tech Lead / Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Authors, operators, release managers |

---

## English

Enterprise teams keep **one technical truth** and ship **paired human-language versions** so operators (often local language) and engineers (often English) read the same procedures without drift.

### Where to start

| Document | Purpose |
|----------|---------|
| [STANDARD.en.md](./STANDARD.en.md) | Canonical localization policy (structure, metadata, CI) |
| [MIGRATION_REGISTRY.md](./MIGRATION_REGISTRY.md) | Per-file EN/PL status and target paths |
| [../en/README.md](../en/README.md) | English documentation index |
| [../pl/README.md](../pl/README.md) | Polish documentation index |

### Layout (target)

```text
docs/
  en/<section>/<DOC>.md     # English
  pl/<section>/<DOC>.md     # Polish (mirror path)
  operations/<DOC>.md         # Legacy PL path during migration (banner → en/pl)
  adr/*.md                  # English canonical (ADR industry norm)
  locales/                  # Policy + registry only
```

### Pilot (paired)

| Polish (legacy) | English |
|-----------------|---------|
| [operations/LIVE_MAP.md](../operations/LIVE_MAP.md) | [en/operations/LIVE_MAP.md](../en/operations/LIVE_MAP.md) |

---

## Polski

W modelu enterprise jest **jedno źródło merytoryczne** i **dwa języki** (zwykle EN dla spec/ADR/API, PL dla runbooków operacyjnych), ze **zwierciadlanymi ścieżkami** w `docs/en/` i `docs/pl/`.

### Gdzie zacząć

| Dokument | Cel |
|----------|-----|
| [STANDARD.pl.md](./STANDARD.pl.md) | Polityka lokalizacji (struktura, metadane, CI) |
| [MIGRATION_REGISTRY.md](./MIGRATION_REGISTRY.md) | Status EN/PL każdego pliku |
| [../pl/README.md](../pl/README.md) | Indeks dokumentacji PL |
| [../en/README.md](../en/README.md) | Indeks dokumentacji EN |

### Pilotaż (para)

| Polski (legacy) | Angielski |
|-----------------|-----------|
| [operations/LIVE_MAP.md](../operations/LIVE_MAP.md) | [en/operations/LIVE_MAP.md](../en/operations/LIVE_MAP.md) |

---

## CI

- Link integrity: `python scripts/check_docs_links.py`
- Locale pairs (registry): `python scripts/check_docs_i18n.py`

Both run in [`.github/workflows/docs.yml`](../../.github/workflows/docs.yml).
