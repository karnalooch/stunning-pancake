# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/HANDOFF_AUTOMATION.md) |
| **translation_status** | machine-translated |
| **canonical_path** | docs/en/operations/HANDOFF_AUTOMATION.md |
---

| | |
|--|--|
| **Status** | Active |
| **Last update** | 2026-06-04 |
| **Audience** | Platform Operator |

**Related:** [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) · [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) · [SIMULATOR.md](./SIMULATOR.md)

## Railway Pro

**Pro is not required** for scripts in this repo. Consider Pro in the **handoff month** (more RAM/vCPU on the project, faster support) - this is a billing decision, not an automation block.

## Sequence (prod/staging)

1. **RAM** — commit + deploy `railway.json` (`brouter`, `celery-worker` → 1 GB). Optional GraphQL `serviceInstanceLimitsUpdate` for immediate effect (see [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)).
2. **Sim prep** - `.\scripts\sim-handoff-prep.ps1` (preflight → batch optional → live warm).
3. **Load test** - [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) + `scripts/load-test-telemetry-ingest.py`.```powershell
$env:SPORT_ADMIN_TOKEN = "<admin JWT>"
.\scripts\sim-handoff-prep.ps1 `
  -ApiBase "https://backend-production-55c7.up.railway.app/api" `
  -TargetUsers 10000 -Intensity 50 -Load 50

# Podgląd bez zmian:
.\scripts\sim-handoff-prep.ps1 -DryRun
```The script sends `intensity` + `load` to live-simulate (SSOT backend); with older API fallback on `active_ratio` / `scale_overrides` from the same patterns in PS1.

The script **ends with an error** when: wipe in progress, `batch_blocks_live`, batch timeout, live does not reach the `currently_riding` threshold.

## Load knobs

| Knob | Where | Effect |
|-------|--------|--------|
| `intensity` / `load` | POST live-simulate (0–100) | Two admin sliders - mapping in `sim_profile.py` |
| `active_ratio` | POST live-simulate / `railway-set-live-active-ratio.ps1` | Rider demand per tick; main lever at backpressure |
| `SCALE_MAX_STARTS_PER_LIVE_TICK` | Railway env (`celery-worker-simulation`) | Route start limit / tick |
| `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK` | as above | HTTP to BRouter on tick |
| `routing_backpressure_active` | GET live-simulate | Queue `routing` > cap - lower `active_ratio` or add replicas routing |
| `tick_seconds` | live-simulate body | Tick ​​rate (min. 2 s API) |
| `pool_pct` | live-simulate body | Athlete Pool Fraction in Live Pool |

Default warm handoff: `-Intensity 50 -Load 50` (`active_ratio≈0.29`), threshold `currently_riding` ≈ `max(500, target × ratio × 0.25)`.

## Budget (~PLN 100)

The estimate applies to **only compute Railway** for short run (batch 10k skip_activities + live warm + ingest bench), not license or transfer:

- ~8 GB plan: monthly project cap; the short test uses a fraction of a month.
- Raising `brouter` / `celery-worker` to 1 GB for handoff: +~0.5-1 GB RAM in 8 GB budget - fits in table [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md).
- **We do not** enable autoscale API or Pro plan changes in the code here.

## Railway Verification (optional)```powershell
.\scripts\railway-verify-production.ps1
```Requires `RAILWAY_API_TOKEN` (User env). He doesn't print secrets.
