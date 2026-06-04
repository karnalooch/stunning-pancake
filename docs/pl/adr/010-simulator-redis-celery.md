# ADR-010: Simulator state in Redis + Celery queue `simulation`

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../adr/010-simulator-redis-celery.md) |
| **canonical_path** | docs/pl/adr/010-simulator-redis-celery.md |
---

## Kontekst

Zbiorcze generowanie użytkowników (10–300 tys.) i symulacja mapy na żywo wykorzystywały wcześniej wątki demona i dyktacje Pythona dla poszczególnych procesów. W obszarze wielozadaniowy Gunicorn:

- `GET /live-simulate/` często zwracał `running: false`, gdy symulacja była uruchamiana na innym procesie roboczym.
- Transmisja na żywo może rozpocząć się w trakcie partii i utworzyć nieaktualną pulę sportowców.
- Brak rozproszonej blokady między procesami.

## Decyzja

1. **Redis** dla wszystkich stanów symulatora (`sim:batch:*`, `sim:live:*`, baseny, przejażdżki, zamki).
2. **Zadania selera** na dedykowanej kolejce **`symulacja`** (`symulacja-pracownika selera` na kolei).
3. **API** tylko kolejkuje pracę i czyta Redis; zaznacza poprzez `run_live_simulation` + `live_tick_task`.
4. **`batch_blocks_live_simulation()`** — nie można rozpocząć transmisji na żywo, gdy wsad jest zablokowany/działa/nie jest w stanie bezczynności.
5. **Frontend** `waitForBatchComplete()` — unikaj wyścigu odpytywania, zanim Seler ustawi `running=true`.

## Konsekwencje

- **Pozytywny:** Prawidłowy status dowolnego pracownika API; poziome skalowanie pracowników symulacyjnych; Wyczyść elementy Runbook operacji.
- **Wadą:** wymaga Redis + drugiej usługi Seler na kolei; BRuter potrzebny do symulacji śledzenia dróg na żywo.
- **Dokumenty:** Pełna specyfikacja pozostaje [SIMULATOR_ARCHITECTURE.md](../SIMULATOR_ARCHITECTURE.md); operacje [operations/SIMULATOR.md](../../operations/SIMULATOR.md).

## Powiązane

- [RAILWAY_CELERY_SIMULATION.md](../../RAILWAY_CELERY_SIMULATION.md)
- [DISK_GUARD.md](../../DISK_GUARD.md)

---

## Pełna wersja (kanoniczna)

Pełny tekst ADR (język źródłowy dokumentu): **[010-simulator-redis-celery.md](../../adr/010-simulator-redis-celery.md)**.

> Skrót PL — nie zastępuje pełnego ADR przy review architektury.
