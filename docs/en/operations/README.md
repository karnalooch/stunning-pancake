# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../operations/README.md) |
| **canonical_path** | docs/en/operations/README.md |
---

**Status:** ✅ Active  
**Last update:** 2026-06-03  
**Purpose:** Short guides "what to do on Railway / in the simulator / on mobile".  
**Matrix (doc · role · tenure):** [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md)  
**Section standard:** [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md)

---

## Railway (prod priority)

| Runbook | Description |
|---------|------|
| [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) | Checklist + `scripts/railway-verify-production.ps1` |
| [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) | OOM, routing worker, caps, RAM (SSOT env) |
| [../RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md) | `celery-worker-simulation` |

---

## Simulator, routing, scale

| Runbook | Description |
|---------|------|
| [SIMULATOR.md](./SIMULATOR.md) | Batch, live map, FSM, wizard Performance |
| [LIVE_MAP.md](./LIVE_MAP.md) | Live Map SSE, LOD, ingest (PL · [EN](./LIVE_MAP.md)) |
| [BROUTER.md](./BROUTER.md) | BRouter, Polish tiles, `pass=0` |
| [../DISK_GUARD.md](../DISK_GUARD.md) | Postgres Disk Budget |
| [../SCALE_TEST_300K.md](../SCALE_TEST_300K.md) | 300k test |
| [../EVENT_BURST_50K.md](../EVENT_BURST_50K.md) | Burst on event day |

---

## Infrastructure and release

| Runbook | Description |
|---------|------|
| [RAILWAY_KUBERNETES.md](./RAILWAY_KUBERNETES.md) | Railway **does not** host K8s |
| [KUBERNETES.md](./KUBERNETES.md) | k8s manifestos |
| [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) | Gate before release |
| [MOBILE.md](./MOBILE.md) | EAS build, env, GPS recovery |
| [../../infrastructure/brouter/README.md](../../../infrastructure/brouter/README.md) | Dockerfile BRouter |

---

## Architecture (spec, not runbook)

[SIMULATOR_ARCHITECTURE.md](../../SIMULATOR_ARCHITECTURE.md) - Redis/Celery details; implementation → SIMULATOR.md.
