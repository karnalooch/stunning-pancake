# Dokumentacja — utrzymanie i świeżość


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](en/MAINTENANCE.md) |
| **canonical_path** | docs/pl/MAINTENANCE.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Tech Lead / Platform Operator |
| **Last reviewed** | 2026-06-03 |

---

## Zasady

1. **Jeden punkt wejścia:** [README.md](./README.md) — pełne drzewo + ścieżki per rola.
2. **Standard:** [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md).
2b. **Jakość kodu (monorepo):** [quality/README.md](./quality/README.md) · baseline: `scripts/run-quality-baseline.ps1`.
3. **Indeksy sekcji:** [operations/OPERATIONS_INDEX.md](./operations/OPERATIONS_INDEX.md) · [admin/ADMIN_INDEX.md](./admin/ADMIN_INDEX.md) · [compliance/COMPLIANCE_INDEX.md](./compliance/COMPLIANCE_INDEX.md).
4. **Runbooki** — krótkie kroki w [operations/](./operations/); spec w korzeniu / ADR.
5. **Raporty** — snapshot; nowy plik z datą w [reports/](./reports/).
6. **Po zmianie symulatora / BRouter / Railway workers** — SIMULATOR, BROUTER, `RAILWAY_*`, [TROUBLESHOOTING.md](./TROUBLESHOOTING.md), [CHANGELOG](../../CHANGELOG.md).

---

## Inwentarz (stan 2026-06-03)

| Sekcja | Pliki .md (szac.) | Ostatni przegląd enterprise |
|--------|-------------------|-----------------------------|
| Korzeń `docs/` | 18 | 2026-06-03 — metadane + SSOT linki |
| `operations/` | 9 + README + INDEX | 2026-06-03 |
| `admin/` | 6 + README + ADMIN_INDEX | 2026-06-03 — P0 DONE, P1 1a done |
| `compliance/` | 4 + INDEX | 2026-06-03 |
| `adr/` | 10 | 2026-06-03 — nagłówki metadanych |
| `reports/` | 8 + README | Snapshot — bez edycji treści |
| `archive/` | 5 + plans README | Deprecated bannery |
| `onboarding/`, `product/` | 2 | 2026-06-03 |
| `runbooks/` | 1 | 2026-06-03 — db_recovery rozszerzony |
| `diagrams/`, `assets/` | 2 | 2026-06-03 |

**Łącznie:** ~68 plików w scope `check_docs_links.py` (bez duplikatów ścieżek Windows).

---

## Statusy produktowe (docs muszą się zgadzać)

| Temat | Status w docs |
|-------|----------------|
| Admin P0 smoke | ✅ DONE — [P0_SMOKE_CHECKLIST](./admin/P0_SMOKE_CHECKLIST.md) |
| Admin P1 Paczka 1a | ✅ done — [P1_ROADMAP](./admin/P1_ROADMAP.md) |
| Admin P1 1b + Sponsor | 🚧 next |
| Railway verify script | ✅ — [RAILWAY_PRODUCTION_CHECKLIST](./operations/RAILWAY_PRODUCTION_CHECKLIST.md) |

---

## Znane luki (backlog dokumentacji)

| Temat | Status |
|-------|--------|
| OpenAPI drift | Ręczna weryfikacja `/api/docs/` po zmianach API |
| Zrzuty Live Map | Opcjonalnie `docs/assets/live/` po UI change |
| `plans/`, `.kilo/plans/` | Poza `docs/` — [archive/plans/README](./archive/plans/README.md) |
| Staging admin | Brak — deploy bez stagingu (P1 §4) |

---

## Checklista po release

- [ ] [CHANGELOG](../../CHANGELOG.md)
- [ ] Env / Railway → [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md) + operations
- [ ] Admin deploy → [P0_SMOKE_CHECKLIST.md](./admin/P0_SMOKE_CHECKLIST.md)
- [ ] Release publiczny → [compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](./compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md)
- [ ] **Last reviewed** w [README.md](./README.md)
- [ ] `python scripts/check_docs_links.py`
