# Standard lokalizacji dokumentacji (enterprise)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Autorzy dokumentacji, reviewerzy |
| **Wersja angielska** | [STANDARD.en.md](./STANDARD.en.md) |

---

## Cel

Każdy dokument **Active** (operacje, onboarding, produkt) ma utrzymywaną wersję **po polsku** i **po angielsku** ze **zwierciadlaną ścieżką** w `docs/pl/` i `docs/en/`, bez duplikowania sekretów ani wartości env.

---

## Jak robi to enterprise

| Wzorzec | Kiedy | Wybór 4VELO |
|---------|--------|-------------|
| **Równoległe drzewa** (`docs/en/`, `docs/pl/`) | Runbooki, onboarding | ✅ Główny model par |
| **Kanoniczny angielski** | ADR, OpenAPI, kontrakty architektury | ✅ `docs/adr/`, `API.md` |
| **Legacy + banner** | Migracja bez łamania linków | ✅ `docs/operations/` na razie PL |
| **Metadane translation** | Audyt i CI | ✅ Wymagane w parach |
| **TMS (Phrase, Lokalise)** | Duże portale produktowe | Opcjonalnie później |
| **MT w CI** | Marketing | ❌ Nie dla runbooków |

---

## Metadane (dokumenty w parze)

W tabeli na górze **obu** plików:

```markdown
| **lang** | pl |
| **translation** | [English](../en/operations/LIVE_MAP.md) |
| **canonical_path** | docs/operations/LIVE_MAP.md |
```

- **lang** — język treści.
- **translation** — link do drugiego języka.
- **canonical_path** — ścieżka w [MIGRATION_REGISTRY](./MIGRATION_REGISTRY.md).

---

## Reguły ścieżek

| Typ | Język kanoniczny | EN | PL |
|-----|------------------|----|----|
| Runbook operacji | PL | `docs/en/operations/<NAZWA>.md` | `docs/pl/operations/` lub legacy `docs/operations/` |
| ADR | EN | `docs/adr/` | Opcjonalnie krótkie `docs/pl/adr/` |
| API / architektura | EN | `docs/API.md` | `docs/pl/API.md` po migracji |
| Checklisty admin | EN | `docs/admin/` | `docs/pl/admin/` po migracji |
| Snapshoty `reports/` | — | Bez pary | — |

Tabele env — **jedno SSOT**; drugi język **linkuje**, nie kopiuje pełnych tabel ([DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md)).

---

## Workflow autora

1. Edytuj plik **kanoniczny** (rejestr).
2. W tym samym PR zaktualizuj **parę**, jeśli zmiana dotyczy kroków operacyjnych lub env.
3. Podnieś **Last reviewed** w obu.
4. Wpis w [MIGRATION_REGISTRY.md](./MIGRATION_REGISTRY.md).
5. `python scripts/check_docs_links.py` oraz `python scripts/check_docs_i18n.py`.

Tylko jeden język zaktualizowany → status `translation-debt` w rejestrze.

---

## Fazy migracji

| Faza | Działanie |
|------|-----------|
| **0** | Polityka + rejestr + CI |
| **1** | Runbooki: EN w `docs/en/operations/`; PL w legacy + banner |
| **2** | Przeniesienie PL do `docs/pl/operations/`; legacy = stub |
| **3** | Przewodniki w korzeniu `docs/` |
| **4** | Opcjonalne streszczenia ADR po PL |

---

## Powiązane

- [STANDARD.en.md](./STANDARD.en.md)
- [README.md](./README.md)
- [MIGRATION_REGISTRY.md](./MIGRATION_REGISTRY.md)
