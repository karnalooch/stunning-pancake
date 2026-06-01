# Dokumentacja — utrzymanie i świeżość

**Ostatni przegląd indeksu:** 2026-06-02  
**Właściciel treści operacyjnych:** zespół backend / DevOps (symulator, Railway, BRouter)

---

## Zasady (jak w poważnym developmencie)

1. **Jeden punkt wejścia:** [README.md](./README.md) — zawsze aktualny spis z linkami.
2. **Runbooki operacyjne** (co robić na produkcji): [operations/](./operations/) — krótkie, sprawdzone kroki.
3. **Specyfikacje / ADR** — zmieniają się rzadko; na górze pliku data statusu i link do runbooka jeśli implementacja żyje w kodzie.
4. **Raporty audytowe** — snapshot w czasie; nie edytujemy ich „na żywo”, tylko dodajemy nowy plik w [reports/](./reports/).
5. **Po każdej większej zmianie w symulatorze / BRouter / Live Map** — aktualizuj `operations/SIMULATOR.md`, `operations/BROUTER.md`, [TROUBLESHOOTING.md](./TROUBLESHOOTING.md), wpis w [CHANGELOG](../CHANGELOG.md).

---

## Inwentarz plików (ostatni commit Git)

| Ostatnia zmiana | Plik | Kategoria | Uwagi |
|-----------------|------|-----------|--------|
| 2026-06-01 | [operations/*](./operations/) (nowe) | Operacje | Symulator, BRouter, Railway |
| 2026-06-01 | [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md) | Operacje | Worker `simulation` |
| 2026-06-01 | [DISK_GUARD.md](./DISK_GUARD.md) | Operacje | Postgres budget |
| 2026-06-01 | [SCALE_TEST_300K.md](./SCALE_TEST_300K.md) | Operacje | Test obciążeniowy |
| 2026-06-01 | [EVENT_BURST_50K.md](./EVENT_BURST_50K.md) | Operacje | Event day burst |
| 2026-06-01 | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Pomoc | CORS 502, symulator |
| 2026-06-01 | [DEPLOYMENT.md](./DEPLOYMENT.md) | Wdrożenie | Railway |
| 2026-05-17 | [SIMULATOR_ARCHITECTURE.md](./SIMULATOR_ARCHITECTURE.md) | Spec | Zaimplementowane; runbook → operations |
| 2026-05-16 | [README.md](./README.md) | Indeks | **Zaktualizowano 2026-06-02** |
| 2026-05-16 | [DEVELOPMENT.md](./DEVELOPMENT.md) | Dev | Struktura repo |
| 2026-05-15 | [CONFIGURATION.md](./CONFIGURATION.md) | Konfig | Brak sekcji SCALE_* — uzupełniono linkiem |
| 2026-05-15 | [UPDATES.md](./UPDATES.md) | Proces | Ogólny guide aktualizacji |
| 2026-05-27 | [reports/*](./reports/) | Archiwum | Snapshoty audytów |
| 2026-04-29 | [adr/](./adr/) | ADR | Stabilne decyzje |
| 2026-04-23 | [archive/](./archive/) | Archiwum | CHARTER, TECH_SPEC — historyczne |
| — | [mockups/](./mockups/) | Design | Nie w Git — opcjonalne |

### Znane luki (do backlogu dokumentacji)

| Temat | Stan w kodzie | Gdzie dokumentować |
|-------|----------------|-------------------|
| `SCALE_*` / `BROUTER_*` env | `scale_config.py`, Railway | [operations/SIMULATOR.md](./operations/SIMULATOR.md), [CONFIGURATION.md](./CONFIGURATION.md) |
| Live Map zoom / znaczniki | `admin/.../LiveMap.tsx` | [operations/SIMULATOR.md](./operations/SIMULATOR.md) |
| Batch przed live (`batch_blocks_live`) | `simulator_state.py` | [operations/SIMULATOR.md](./operations/SIMULATOR.md) |
| BRouter Docker 1.7.9 + Polska `.rd5` | `infrastructure/brouter/` | [operations/BROUTER.md](./operations/BROUTER.md) |
| Mobile GPS resilience | `mobile/` | Brak dedykowanego runbooka — ADR-005 częściowo |
| API admin simulator | `admin_views.py` | [API.md](./API.md) — sekcja do rozszerzenia |

---

## Szybka checklista po release

- [ ] Wpis w [CHANGELOG](../CHANGELOG.md)
- [ ] Jeśli env / Railway: [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md) + operations
- [ ] Jeśli UI mapy: zrzut ekranu w `docs/assets/live/` (opcjonalnie)
- [ ] Data „Ostatni przegląd” w [README.md](./README.md)
