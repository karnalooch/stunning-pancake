# Handoff automation — Railway sim prep

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/HANDOFF_AUTOMATION.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/en/operations/HANDOFF_AUTOMATION.md |

---

| | |
|--|--|
| **Status** | Active |
| **Last update** | 2026-06-04 |
| **Audience** | Platform Operator |

**Related:** [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) · [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) · [SIMULATOR.md](./SIMULATOR.md)

## Railway Pro

**Pro is not required** for scripts in this repo. Consider Pro in the **handoff month** (more RAM/vCPU on the project, faster support) — a billing decision, not an automation blocker.

## Sequence (prod/staging)

1. **RAM** — commit + deploy `railway.json` (`brouter`, `celery-worker` → 1 GB). Optional GraphQL `serviceInstanceLimitsUpdate` for immediate effect (see [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)).
2. **Sim prep** — `.\scripts\sim-handoff-prep.ps1` (preflight → batch optional → live warm).
3. **Load test** — [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) + `scripts/load-test-telemetry-ingest.py`.

```powershell
$env:SPORT_ADMIN_TOKEN = "<admin JWT>"
.\scripts\sim-handoff-prep.ps1 `
  -ApiBase "https://backend-production-55c7.up.railway.app/api" `
  -TargetUsers 10000 -Intensity 50 -Load 50

# Preview without changes:
.\scripts\sim-handoff-prep.ps1 -DryRun
```

The script sends `intensity` + `load` to live-simulate (backend SSOT); older APIs fall back to `active_ratio` / `scale_overrides` from the same patterns in the PS1 script.

The script **exits with an error** when: wipe in progress, `batch_blocks_live`, batch timeout, or live does not reach the `currently_riding` threshold.

## Load knobs

| Knob | Where | Effect |
|-------|--------|--------|
| `intensity` / `load` | POST live-simulate (0–100) | Two admin sliders — mapping in `sim_profile.py` |
| `active_ratio` | POST live-simulate / `railway-set-live-active-ratio.ps1` | Rider demand per tick; main lever under backpressure |
| `SCALE_MAX_STARTS_PER_LIVE_TICK` | Railway env (`celery-worker-simulation`) | Route start limit per tick |
| `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK` | as above | HTTP calls to BRouter per tick |
| `routing_backpressure_active` | GET live-simulate | Queue `routing` > cap — lower `active_ratio` or add routing replicas |
| `tick_seconds` | live-simulate body | Tick rate (min. 2 s API) |
| `pool_pct` | live-simulate body | Athlete pool fraction in live pool |

Default warm handoff: `-Intensity 50 -Load 50` (`active_ratio≈0.29`), threshold `currently_riding` ≈ `max(500, target × ratio × 0.25)`.

## Budget (~PLN 100)

Estimate covers **Railway compute only** for a short run (batch 10k `skip_activities` + live warm + ingest bench), not licenses or data transfer:

- ~8 GB plan: monthly project cap; a short test uses a fraction of one month.
- Raising `brouter` / `celery-worker` to 1 GB for handoff: +~0.5–1 GB RAM in the 8 GB budget — fits the table in [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md).
- **We do not** enable autoscale API or Pro plan changes in code here.

## Railway verification (optional)

```powershell
.\scripts\railway-verify-production.ps1
```

Requires `RAILWAY_API_TOKEN` (user env). Does not print secrets.
