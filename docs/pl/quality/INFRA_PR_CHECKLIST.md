# Lista kontrolna PR infrastruktury

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../quality/INFRA_PR_CHECKLIST.md) |
| **canonical_path** | docs/pl/quality/INFRA_PR_CHECKLIST.md |
---

Użyj, gdy różnica dotyczy `infrastructure/`, `docker-compose*`, `*/railway.json`, skryptów OSRM/BRouter lub obrazów usług routingu.

## Przed połączeniem

- [ ] **Sekrety:** brak tokenów, haseł DB i prywatnych adresów URL w git; `.env.example` aktualizowany tylko za pomocą symboli zastępczych
- [ ] **Kondycja:** nowe usługi ujawniają punkt końcowy kondycji lub udokumentowaną sondę „curl”.
- [ ] **Woluminy:** Ścieżki danych Postgres/Redis/OSRM udokumentowane w `docs/operations/`
- [ ] **BRouter/OSRM:** zmiany adresu URL profilu lub wykresu odnotowane w [BROUTER.md](../../operations/BROUTER.md) lub elemencie Runbook OSRM
- [ ] **Kolej:** nazwy usług odpowiadają `railway.json`; zmienne wymienione w `.env.example`
- [ ] **Wycofanie:** wycofanie jednego akapitu w opisie PR (przywróć tag obrazu / zmienną env)
- [ ] **Wczytaj:** jeśli pojemność tras ulegnie zmianie, łącze [TELEMETRY_LOAD_TEST.md](../../operations/TELEMETRY_LOAD_TEST.md) lub notatki przed lotem karty SIM

## Powiązane dokumenty

- [BROUTER.md](../../operations/BROUTER.md)
- [ADR 011](../adr/011-telemetry-ingest-durability-under-load.md) — pobieranie pod obciążeniem
- [PR_CHECKLIST.md](./PR_CHECKLIST.md) — ogólne bramki jakości
