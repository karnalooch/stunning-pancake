# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../runbooks/celery-backlog.md) |
| **canonical_path** | docs/en/runbooks/celery-backlog.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-03 |
| **Audience** | On-call, Backend Lead |
| **Target** | Stabilization of Celera workers and queues (`routing`, `simulation`) when tasks accumulate or the live tick falls. |

---

## Symptoms

| Symptom | Probable cause |
|-------|-------------------------|
| Redis queue depth increases | Too few workers or too high `concurrency` → OOM |
| `WorkerLostError` / SIGKILL | OOM on Railway - see SSOT below |
| Live tick ~0 s, 0 riders | Worker dead or queue blocked |
| `ride_warming` / `ROUTING` stuck | No `routing` consumer |

**SSOT diagnostics and caps:** [operations/RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md)

---

## Prerequisites

| Requirement | Notes |
|-----------|--------|
| Railway access/hosting | Role of Platform Operator |
| `RAILWAY_API_TOKEN` | Only in user env - **not** in docs |
| Product verification | `.\scripts\railway-verify-production.ps1` |

**Related:** [RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md) · [SIMULATOR_ARCHITECTURE.md](../../SIMULATOR_ARCHITECTURE.md) · [operations/SIMULATOR.md](../operations/SIMULATOR.md) · [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)

---

## Procedure (shortcut)

### 1. Confirm scope (role: Platform Operator)

- Check the depth of Redis queues (`routing`, `celery`, simulator).
- Compare the `celery-worker-simulation` and `celery-worker-routing` logs with the symptoms in [RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md).

### 2. Limit the load (role: Platform Operator)

- Temporarily lower `SCALE_MAX_CONCURRENT_RIDERS` / `SCALE_MAX_STARTS_PER_LIVE_TICK` according to the caps table in SSOT.
- Don't restart all workers at the same time without ingestion isolation (risk of duplicate ticks).

### 3. Restore consumers (role: Platform Operator)

- Make sure that **both** services are running: `celery-worker-simulation` and `celery-worker-routing` (separate queues).
- After OOM: reduce `concurrency' prefork, increase container RAM or load sharing - see SSOT for details.

### 4. Verification (role: Platform Operator)

- Live tick restores riders on the admin map.
- The `routing` queue is decreasing; no persistent `ROUTING` states in DB.
- Run `.\scripts\railway-verify-production.ps1` (without printing secrets).

---

## Escalation

| Level | Action |
|--------|-----------|
| P1 | Notify Backend Lead; document timeline under post-mortem ([CONSTITUTION.md](../CONSTITUTION.md) §9) |
| P0 | Stop live simulator / ingesta by [operations/SIMULATOR.md](../operations/SIMULATOR.md) |

---

## After the incident

- Update **Last reviewed** in this file and in [RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md) if `SCALE_*` limits have been changed.
- Post-mortem: `docs/runbooks/postmortems/` (if directory exists).
