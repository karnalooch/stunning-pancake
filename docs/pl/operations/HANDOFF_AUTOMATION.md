# Automatyzacja handoffu i load testu


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../../en/operations/HANDOFF_AUTOMATION.md) |
| **canonical_path** | docs/pl/operations/HANDOFF_AUTOMATION.md |

---

| | |
|--|--|
| **Status** | Active |
| **Ostatnia aktualizacja** | 2026-06-04 |
| **Audience** | Platform Operator |

**Powiązane:** [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) · [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) · [SIMULATOR.md](./SIMULATOR.md)

## Railway Pro

**Pro nie jest wymagane** do skryptów w tym repo. Rozważ Pro w **miesiącu handoffu** (więcej RAM/vCPU na projekcie, szybszy support) — to decyzja billingowa, nie blokada automatyzacji.

## Sekwencja (prod / staging)

1. **RAM** — commit + deploy `railway.json` (`brouter`, `celery-worker` → 1 GB). Opcjonalnie GraphQL `serviceInstanceLimitsUpdate` dla natychmiastowego efektu (patrz [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)).
2. **Sim prep** — `.\scripts\sim-handoff-prep.ps1` (preflight → batch opcjonalnie → live warm).
3. **Load test** — [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) + `scripts/load-test-telemetry-ingest.py`.

```powershell
$env:SPORT_ADMIN_TOKEN = "<admin JWT>"
.\scripts\sim-handoff-prep.ps1 `
  -ApiBase "https://backend-production-55c7.up.railway.app/api" `
  -TargetUsers 10000 -Intensity 50 -Load 50

# Podgląd bez zmian:
.\scripts\sim-handoff-prep.ps1 -DryRun
```

Skrypt wysyła `intensity` + `load` do live-simulate (SSOT backend); przy starszym API fallback na `active_ratio` / `scale_overrides` z tych samych wzorów w PS1.

Skrypt **kończy się błędem**, gdy: wipe w toku, `batch_blocks_live`, batch timeout, live nie osiągnie progu `currently_riding`.

## Gałki obciążenia

| Gałka | Gdzie | Efekt |
|-------|--------|--------|
| `intensity` / `load` | POST live-simulate (0–100) | Dwa suwaki admin — mapowanie w `sim_profile.py` |
| `active_ratio` | POST live-simulate / `railway-set-live-active-ratio.ps1` | Popyt jeźdźców na tick; główna dźwignia przy backpressure |
| `SCALE_MAX_STARTS_PER_LIVE_TICK` | Railway env (`celery-worker-simulation`) | Limit startów tras / tick |
| `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK` | j.w. | HTTP do BRouter na tick |
| `routing_backpressure_active` | GET live-simulate | Kolejka `routing` > cap — obniż `active_ratio` lub dodaj repliki routing |
| `tick_seconds` | live-simulate body | Częstotliwość ticków (min. 2 s API) |
| `pool_pct` | live-simulate body | Ułamek puli athlete w live pool |

Domyślny warm handoffu: `-Intensity 50 -Load 50` (`active_ratio≈0.29`), próg `currently_riding` ≈ `max(500, target × ratio × 0.25)`.

## Budżet (~100 PLN)

Szacunek dotyczy **tylko compute Railway** na krótki run (batch 10k skip_activities + live warm + ingest bench), nie licencji ani transferu:

- ~8 GB plan: miesięczny cap projektu; krótki test zużywa ułamek miesiąca.
- Podniesienie `brouter` / `celery-worker` do 1 GB na czas handoffu: +~0,5–1 GB RAM w budżecie 8 GB — mieści się w tabeli [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md).
- **Nie** włączamy tutaj autoscale API ani zmian planu Pro w kodzie.

## Weryfikacja Railway (opcjonalnie)

```powershell
.\scripts\railway-verify-production.ps1
```

Wymaga `RAILWAY_API_TOKEN` (User env). Nie drukuje sekretów.
