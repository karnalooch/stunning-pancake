# ADR 012: Mobile performance budgets (HUD / GPS)

| | |
|--|--|
| **Status** | Accepted |
| **Owner role** | Mobile Lead |
| **Last reviewed** | 2026-06-11 |

## Kontekst
Aplikacja mobilna przetwarza telemetrię GPS w tle i renderuje HUD podczas jazdy. Regresje wydajności są trudne do wychwycenia bez mierzalnych progów.

## Decyzja
Wprowadzamy budżety runtime w `mobile/src/services/performanceBudget.ts`:

| Metryka | Budżet | Miejsce pomiaru |
|---------|--------|-----------------|
| `hudMinFps` | 55 FPS (deb frame debt) | `useFrameBudgetMonitor` w HUD |
| `gpsIngestLatencyMs` | 2000 ms | `gpsSyncUpload.postTelemetryBatch` |
| `outboxFlushMs` | 5000 ms | `gpsSyncUpload.processGpsOutbox` |
| `mmkvWriteMs` | 16 ms | rezerwa pod przyszłe hooki zapisu MMKV |

Naruszenia raportujemy jako event `perf_budget_violation` (Firebase Analytics / console w dev).

## Konsekwencje
- Regresje można śledzić w analytics bez profilera na urządzeniu.
- Budżety są konfigurowalne w jednym pliku SSOT.
- E2E Maestro pokrywa flow krytyczne; budżety uzupełniają monitoring ciągły.
