# RUNBOOK: Celery — rosnące kolejki / backlog


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../../en/runbooks/celery-backlog.md) |
| **canonical_path** | docs/pl/runbooks/celery-backlog.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-03 |
| **Audience** | On-call, Backend Lead |
| **Cel** | Stabilizacja workerów Celery i kolejek (`routing`, `simulation`) gdy zadania się kumulują lub live tick pada. |

---

## Objawy

| Objaw | Prawdopodobna przyczyna |
|-------|-------------------------|
| Redis queue depth rośnie | Za mało workerów lub zbyt wysoka `concurrency` → OOM |
| `WorkerLostError` / SIGKILL | OOM na Railway — patrz SSOT poniżej |
| Live tick ~0 s, 0 riders | Worker martwy lub kolejka zablokowana |
| `ride_warming` / `ROUTING` utknięte | Brak konsumenta `routing` |

**SSOT diagnostyka i caps:** [operations/RAILWAY_CELERY_MEMORY.md](../../operations/RAILWAY_CELERY_MEMORY.md)

---

## Wymagania wstępne

| Wymaganie | Uwagi |
|-----------|--------|
| Dostęp Railway / hosting | Rola Platform Operator |
| `RAILWAY_API_TOKEN` | Tylko w env użytkownika — **nie** w docs |
| Weryfikacja prod | `.\scripts\railway-verify-production.ps1` |

**Powiązane:** [RAILWAY_CELERY_SIMULATION.md](../../RAILWAY_CELERY_SIMULATION.md) · [SIMULATOR_ARCHITECTURE.md](../../SIMULATOR_ARCHITECTURE.md) · [operations/SIMULATOR.md](../../operations/SIMULATOR.md) · [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md)

---

## Procedura (skrót)

### 1. Potwierdź zakres (rola: Platform Operator)

- Sprawdź głębokość kolejek Redis (`routing`, `celery`, symulator).
- Porównaj logi `celery-worker-simulation` i `celery-worker-routing` z objawami w [RAILWAY_CELERY_MEMORY.md](../../operations/RAILWAY_CELERY_MEMORY.md).

### 2. Ogranicz obciążenie (rola: Platform Operator)

- Tymczasowo obniż `SCALE_MAX_CONCURRENT_RIDERS` / `SCALE_MAX_STARTS_PER_LIVE_TICK` zgodnie z tabelą caps w SSOT.
- Nie restartuj wszystkich workerów jednocześnie bez izolacji ingestii (ryzyko duplikatów tick).

### 3. Przywróć konsumentów (rola: Platform Operator)

- Upewnij się, że działają **oba** serwisy: `celery-worker-simulation` i `celery-worker-routing` (osobne kolejki).
- Po OOM: zmniejsz prefork `concurrency`, zwiększ RAM kontenera lub podziel obciążenie — szczegóły w SSOT.

### 4. Weryfikacja (rola: Platform Operator)

- Live tick przywraca riderów na mapie admin.
- Kolejka `routing` maleje; brak utrwalonych stanów `ROUTING` w DB.
- Uruchom `.\scripts\railway-verify-production.ps1` (bez drukowania sekretów).

---

## Eskalacja

| Poziom | Działanie |
|--------|-----------|
| P1 | Powiadom Backend Lead; dokumentuj oś czasu pod post-mortem ([CONSTITUTION.md](../../CONSTITUTION.md) §9) |
| P0 | Zatrzymaj symulator live / ingestę według [operations/SIMULATOR.md](../../operations/SIMULATOR.md) |

---

## Po incydencie

- Zaktualizuj **Last reviewed** w tym pliku i w [RAILWAY_CELERY_MEMORY.md](../../operations/RAILWAY_CELERY_MEMORY.md) jeśli zmieniono limity `SCALE_*`.
- Post-mortem: `docs/runbooks/postmortems/` (gdy katalog istnieje).
