# ADR-010: Simulator state in Redis + Celery queue `simulation`


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../pl/adr/010-simulator-redis-celery.md) |
| **canonical_path** | docs/adr/010-simulator-redis-celery.md |

---

| | |
|--|--|
| **Status** | Accepted |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-03 |
| **Language** | English |
| **Index** | [docs/README.md](../README.md) |
| **Spec** | [SIMULATOR_ARCHITECTURE.md](../SIMULATOR_ARCHITECTURE.md) |
| **Runbook** | [operations/SIMULATOR.md](../operations/SIMULATOR.md) |

**Supersedes:** In-process `threading` + module dicts in `admin_views.py`

---

## Context

Batch user generation (10k–300k) and live map simulation previously used daemon threads and per-process Python dicts. Under Gunicorn multi-worker:

- `GET /live-simulate/` often returned `running: false` while simulation ran on another worker.
- Live could start during batch and build a stale athlete pool.
- No distributed lock across processes.

## Decision

1. **Redis** for all simulator state (`sim:batch:*`, `sim:live:*`, pools, rides, locks).
2. **Celery** tasks on dedicated queue **`simulation`** (`celery-worker-simulation` on Railway).
3. **API** only enqueues work and reads Redis; ticks via `run_live_simulation` + `live_tick_task`.
4. **`batch_blocks_live_simulation()`** — live cannot start while batch lock / running / non-idle phase.
5. **Frontend** `waitForBatchComplete()` — avoid polling race before Celery sets `running=true`.

## Consequences

- **Positive:** Correct status from any API worker; horizontal scaling of simulation workers; clear ops runbooks.
- **Negative:** Requires Redis + second Celery service on Railway; BRouter needed for road-following live sim.
- **Docs:** Full spec remains [SIMULATOR_ARCHITECTURE.md](../SIMULATOR_ARCHITECTURE.md); operations [operations/SIMULATOR.md](../operations/SIMULATOR.md).

## Related

- [RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md)
- [DISK_GUARD.md](../DISK_GUARD.md)
