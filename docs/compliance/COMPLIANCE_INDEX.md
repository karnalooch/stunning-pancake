# Compliance — macierz dokumentów


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../en/compliance/COMPLIANCE_INDEX.md) |
| **canonical_path** | docs/compliance/COMPLIANCE_INDEX.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Legal / DPO / Release Manager |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Release Manager, Product, Legal |
| **Hub** | [README.md](./README.md) |

---

## Cel

Jedna tabela gate’ów zgodności przed release publicznym i mapowanie na runbooki operacyjne (bez duplikacji checklist).

---

## Macierz

| Dokument | Język | Audience | Kiedy używać |
|----------|-------|----------|--------------|
| [RCP.md](./RCP.md) | PL | DPO / Legal | Rejestr czynności (RODO) — referencja stała |
| [RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](./RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) | EN | Release Manager | **Gate** przed release publicznym (OSS, GDPR, ToS) |
| [MAP_BASEMAP_LICENSING.md](./MAP_BASEMAP_LICENSING.md) | EN | Product / Legal | Mapy bazowe (OSM, komercyjne warstwy) |

---

## Procedura release (skrót)

| Krok | Rola | Akcja |
|------|------|--------|
| 1 | Release Manager | [RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](./RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) — Go/No-Go |
| 2 | Release Manager | [operations/PRE_RELEASE_VERIFICATION.md](../operations/PRE_RELEASE_VERIFICATION.md) |
| 3 | DPO (jeśli zmiana zakresu danych) | Aktualizacja [RCP.md](./RCP.md) |
| 4 | Product | Mapy: [MAP_BASEMAP_LICENSING.md](./MAP_BASEMAP_LICENSING.md) |

---

## Weryfikacja

- Checklisty w release package wypełnione i podpisane (bez sekretów w repo).
- Mobile legal flow zgodny z RCP — [onboarding/GUIDE.md](../onboarding/GUIDE.md) § Legal.

---

## Powiązane

| Dokument | Opis |
|----------|------|
| [../operations/PRE_RELEASE_VERIFICATION.md](../operations/PRE_RELEASE_VERIFICATION.md) | Gate techniczny CI + smoke |
| [../admin/P0_SMOKE_CHECKLIST.md](../admin/P0_SMOKE_CHECKLIST.md) | Smoke panelu admin |
| [../product/FAQ.md](../product/FAQ.md) | FAQ użytkownika (prywatność, anti-cheat) |
